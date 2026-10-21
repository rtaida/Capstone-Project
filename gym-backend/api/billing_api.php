<?php






error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/billing_error_log.txt');

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
require_once __DIR__ . '/config/auth.php';
require_once __DIR__ . '/config/audit.php';
require_once __DIR__ . '/config/billing_schema.php';
$authUser = requireRole(['admin', 'staff']);


function getConnection(): PDO
{
    try {
        $conn = new PDO(
            "odbc:Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=GymDB;Trusted_Connection=yes;TrustServerCertificate=yes;"
        );
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $conn->exec("SET NOCOUNT ON");
        return $conn;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database connection failed: ' . $e->getMessage()
        ]);
        exit;
    }
}

function normalizeDays($value): int
{
    $days = (int) $value;
    return in_array($days, [7, 14], true) ? $days : 7;
}

function syncBillingStatuses(PDO $conn): void
{
    $conn->exec("
        UPDATE bd
        SET status='paid', resolved_at=COALESCE(bd.resolved_at, GETDATE())
        FROM dbo.bill_details bd
        WHERE bd.status='pending'
          AND EXISTS (SELECT 1 FROM dbo.billing_records br WHERE br.bill_id=bd.bill_id AND br.attendance_id IS NOT NULL)
                    AND EXISTS (SELECT 1 FROM dbo.billing_records br INNER JOIN dbo.payments p ON p.attendance_id=br.attendance_id WHERE br.bill_id=bd.bill_id)
                    AND NOT EXISTS (SELECT 1 FROM dbo.billing_records br WHERE br.bill_id=bd.bill_id AND NOT EXISTS (SELECT 1 FROM dbo.payments p WHERE p.attendance_id=br.attendance_id))
          AND NOT EXISTS (
              SELECT 1 FROM dbo.billing_records br
              INNER JOIN dbo.payments p ON p.attendance_id=br.attendance_id
              WHERE br.bill_id=bd.bill_id AND p.payment_status <> 'paid'
          )
    ");
}

function processOverdue(PDO $conn, int $thresholdDays): int
{
        $stmt = $conn->prepare("SELECT p.payment_id, p.member_id, p.walk_in_id, p.attendance_id, p.amount
        FROM dbo.payments p
        WHERE p.payment_status='pending'
                    AND p.payment_type IN ('REGULAR_SESSION','TRAINER_SESSION','PROMOTION')
                    AND (p.member_id IS NOT NULL OR p.walk_in_id IS NOT NULL)
          AND p.payment_date <= DATEADD(day, -?, GETDATE())
                ORDER BY p.member_id, p.walk_in_id, p.attendance_id, p.payment_id");
    $stmt->execute([$thresholdDays]);
    $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$payments) return 0;

    $createdLines = 0;
    $conn->beginTransaction();
    try {
        $byOwner = [];
        foreach ($payments as $payment) {
            $memberId = $payment['member_id'] !== null ? (int) $payment['member_id'] : null;
            $walkInId = $payment['walk_in_id'] !== null ? (int) $payment['walk_in_id'] : null;
            $ownerKey = $memberId !== null ? 'member:' . $memberId : 'walkin:' . $walkInId;
            $attendanceKey = $payment['attendance_id'] !== null ? (string) (int) $payment['attendance_id'] : 'non-attendance';
            $byOwner[$ownerKey]['member_id'] = $memberId;
            $byOwner[$ownerKey]['walk_in_id'] = $walkInId;
            $byOwner[$ownerKey]['lines'][$attendanceKey][] = $payment;
        }
        $markBilled = $conn->prepare("UPDATE dbo.payments SET payment_status='billed', confirmed_at=NULL, confirmed_by=NULL, rejection_reason=NULL WHERE payment_id=? AND payment_status='pending'");
        foreach ($byOwner as $owner) {
            $billId = getOrCreatePendingBill($conn, $owner['member_id'], $owner['walk_in_id'], null, 'Moved to Billing because the member failed to make payment within his/her session.');
            foreach ($owner['lines'] as $attendanceKey => $attendanceRows) {
                $amount = array_sum(array_map(static fn($row) => (float) $row['amount'], $attendanceRows));
                $attendanceId = $attendanceKey === 'non-attendance' ? null : (int) $attendanceKey;
                addBillingAttendanceAmount($conn, $billId, $attendanceId, $amount);
                $createdLines++;
                foreach ($attendanceRows as $payment) {
                    $markBilled->execute([(int) $payment['payment_id']]);
                }
            }
        }
        $conn->commit();
        return $createdLines;
    } catch (Throwable $error) {
        if ($conn->inTransaction()) $conn->rollBack();
        throw $error;
    }
}

function getBillingInvoices(PDO $conn, string $status, string $search, int $memberId = 0): array
{
    $sql = "
        SELECT
            bd.bill_id, bd.member_id, bd.walk_in_id, bd.admin_staff_id,
            bd.total_amount, bd.description, bd.status AS billing_status,
            bd.created_at, bd.resolved_at,
            COALESCE(m.full_name, w.client_name, 'Unknown member') AS member_name,
            COALESCE(m.email, w.email) AS member_email,
            m.phone AS member_phone,
            (SELECT COUNT(*) FROM dbo.billing_records br WHERE br.bill_id=bd.bill_id) AS item_count,
            (SELECT MAX(p.payment_method) FROM dbo.payments p
             WHERE p.payment_status IN ('billed','paid') AND (
                 (bd.member_id IS NOT NULL AND p.member_id=bd.member_id) OR
                 (bd.walk_in_id IS NOT NULL AND p.walk_in_id=bd.walk_in_id)
             )) AS payment_method,
            DATEDIFF(day, DATEADD(day, 7, bd.created_at), GETDATE()) AS overdue_days
        FROM dbo.bill_details bd
        LEFT JOIN dbo.members m ON m.memberID=bd.member_id
        LEFT JOIN dbo.walk_in_records w ON w.id=bd.walk_in_id
    ";

    $conditions = [];
    $params = [];

    if ($status !== '' && $status !== 'all') {
        if ($status === 'open') {
            $conditions[] = 'bd.status IN (?, ?)';
            $params[] = 'pending';
            $params[] = 'partial';
        } else {
            $conditions[] = 'bd.status = ?';
            $params[] = $status;
        }
    }

    if ($memberId > 0) {
        $conditions[] = 'bd.member_id = ?';
        $params[] = $memberId;
    }

    if ($search !== '') {
        $conditions[] = "(
            COALESCE(m.full_name, w.client_name) LIKE ?
            OR m.email LIKE ?
            OR bd.description LIKE ?
            OR CAST(bd.bill_id AS VARCHAR(20)) LIKE ?
        )";

        $like = '%' . $search . '%';
        array_push($params, $like, $like, $like, $like);
    }

    if ($conditions) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $sql .= " ORDER BY CASE bd.status WHEN 'pending' THEN 0 ELSE 1 END, bd.created_at DESC, bd.bill_id DESC";

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function addMemberNotification(PDO $conn, int $memberId, string $title, string $message, string $type = 'info'): void
{
    $stmt = $conn->prepare(
        "INSERT INTO notifications
            (title, message, type, role, recipient_id, is_read, created_at)
         VALUES (?, ?, ?, 'member', ?, 0, GETDATE())"
    );
    $stmt->execute([$title, $message, $type, $memberId]);
}

function sendBillingNotice(PDO $conn, int $billId, int $adminId): array
{
    $stmt = $conn->prepare(
        "SELECT bd.bill_id, bd.total_amount, bd.created_at, bd.member_id, bd.walk_in_id,
            COALESCE(m.full_name, w.client_name) AS full_name,
            COALESCE(m.email, w.email) AS email
         FROM dbo.bill_details bd
         LEFT JOIN dbo.members m ON m.memberID = bd.member_id
         LEFT JOIN dbo.walk_in_records w ON w.id = bd.walk_in_id
         WHERE bd.bill_id = ?"
    );
    $stmt->execute([$billId]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$record) {
        throw new RuntimeException('Billing record or member not found.');
    }

    $amount = number_format((float) $record['total_amount'], 2);
    $dueDate = date('F j, Y', strtotime((string) $record['created_at'] . ' +7 days'));
    $message = "Hello {$record['full_name']}, this is your Capra Fitness billing notice for ₱{$amount}. "
        . "Please settle this amount by {$dueDate}. Contact the gym if you need assistance.";

    if (!empty($record['member_id'])) {
        addMemberNotification($conn, (int) $record['member_id'], 'Payment Notice', $message, 'warning');
    }

    $emailSent = false;
    if (!empty($record['email'])) {
        require_once __DIR__ . '/config/email_config.php';
        $safeAmount = htmlspecialchars("₱{$amount}", ENT_QUOTES, 'UTF-8');
        $safeDueDate = htmlspecialchars($dueDate, ENT_QUOTES, 'UTF-8');
        $html = capraEmailShell(
            'Payment notice',
            'Your billing notice',
            "Hello {$record['full_name']}, this is your Capra Fitness billing notice.",
            '<div style="margin:24px 0;padding:22px;background:#191714;border:1px solid #8f6b31;border-radius:8px;">'
            . '<div style="color:#aaa297;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">Amount due</div>'
            . '<div style="margin-top:8px;color:#f4d48b;font-size:30px;font-weight:700;">' . $safeAmount . '</div>'
            . '<div style="margin-top:18px;color:#d4d0c8;font-size:15px;">Please settle this amount by <strong style="color:#fff;">' . $safeDueDate . '</strong>.</div>'
            . '</div><p style="margin:0;color:#9f9a91;font-size:13px;line-height:1.6;">If you need assistance, please contact the gym team. We will be happy to help.</p>'
        );
        $emailSent = smtpSendHtml(
            (string) $record['email'],
            'Capra Fitness Payment Notice',
            $html,
            "Hello {$record['full_name']}, this is your Capra Fitness billing notice for your session amounted ₱{$amount}. Please settle this amount by {$dueDate}. Contact the gym if you need assistance.\r\n\r\nCapra Fitness"
        );
    }

    return ['email_sent' => $emailSent, 'member_name' => $record['full_name']];
}

function markBillingPaid(PDO $conn, int $billId, int $adminId): void
{
    $stmt = $conn->prepare("SELECT bill_id, member_id, walk_in_id, status FROM dbo.bill_details WITH (UPDLOCK, ROWLOCK) WHERE bill_id=?");
    $stmt->execute([$billId]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$record) {
        throw new RuntimeException('Invoice not found.');
    }
    if (strtolower((string) $record['status']) !== 'pending') {
        throw new RuntimeException('This invoice is not pending payment.');
    }

    $ownerColumn = !empty($record['member_id']) ? 'member_id' : 'walk_in_id';
    $ownerId = (int) ($record[$ownerColumn] ?? 0);
    if ($ownerId <= 0) throw new RuntimeException('Invoice has no member or walk-in owner.');
    $paymentsStmt = $conn->prepare("SELECT DISTINCT p.payment_id, p.member_id, p.walk_in_id, p.payment_type, p.session_id, p.attendance_id
        FROM dbo.payments p WHERE p.payment_status='billed' AND p.{$ownerColumn}=?");
    $paymentsStmt->execute([$ownerId]);
    $payments = $paymentsStmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$payments) {
        throw new RuntimeException('No payable attendance payments were found for this invoice.');
    }

    $updatePayment = $conn->prepare("UPDATE dbo.payments SET payment_status='paid', confirmed_at=GETDATE(), confirmed_by=?, rejection_reason=NULL WHERE payment_id=? AND payment_status='billed'");
    $sessionIds = [];
    $attendanceIds = [];
    foreach ($payments as $payment) {
        $updatePayment->execute([$adminId, (int) $payment['payment_id']]);
        if (!empty($payment['attendance_id'])) $attendanceIds[(int) $payment['attendance_id']] = true;
        if ((string) $payment['payment_type'] === 'TRAINER_SESSION' && !empty($payment['session_id'])) {
            $sessionIds[(int) $payment['session_id']] = (int) $payment['member_id'];
        }
        if ((string) $payment['payment_type'] === 'PROMOTION') {
            $promoStmt = $conn->prepare(
                "UPDATE pa
                 SET pa.status='active', pa.availed_at=GETDATE(),
                     pa.expiration_date=DATEADD(DAY, p.duration_days, CAST(GETDATE() AS DATE))
                 FROM dbo.promo_availments pa
                 INNER JOIN dbo.promotions p ON p.id=pa.promo_id
                 WHERE pa.payment_id=? AND pa.member_id=?
                   AND p.is_active=1 AND CAST(GETDATE() AS DATE)<=p.availment_deadline"
            );
            $promoStmt->execute([(int) $payment['payment_id'], (int) $payment['member_id']]);
            if ($promoStmt->rowCount() !== 1) {
                throw new RuntimeException('A promotion on this invoice is no longer available to activate.');
            }
        }
    }

    if (!empty($record['walk_in_id'])) {
        $stmt = $conn->prepare("UPDATE dbo.walk_in_records SET payment_status='paid', confirmed_at=GETDATE(), confirmed_by=?, rejection_reason=NULL WHERE id=?");
        $stmt->execute([$adminId, (int) $record['walk_in_id']]);
    }

    foreach (array_keys($attendanceIds) as $attendanceId) {
        $stmt = $conn->prepare("UPDATE dbo.attendance_records SET payment_status='paid' WHERE id=?");
        $stmt->execute([$attendanceId]);
    }
    foreach ($sessionIds as $sessionId => $memberId) {
        $stmt = $conn->prepare("UPDATE dbo.trainer_sessions SET is_paid=1, is_booked=1 WHERE id=?");
        $stmt->execute([$sessionId]);

        $stmt = $conn->prepare(
            "UPDATE dbo.member_session_enrollments
             SET status='paid' WHERE member_id=? AND session_id=?"
        );
        $stmt->execute([$memberId, $sessionId]);
    }

    $stmt = $conn->prepare("UPDATE dbo.bill_details SET status='paid', resolved_at=COALESCE(resolved_at, GETDATE()) WHERE bill_id=?");
    $stmt->execute([$billId]);

    if (!empty($record['member_id'])) {
        addMemberNotification(
            $conn,
            (int) $record['member_id'],
            'Payment Confirmed',
            'Your Capra Fitness payment has been confirmed and marked as paid.',
            'success'
        );
    }
}

function partialBillingPayment(PDO $conn, int $billId, int $adminId, array $selectedItems): array
{
    $stmt = $conn->prepare("SELECT bill_id, member_id, walk_in_id, total_amount, status FROM dbo.bill_details WITH (UPDLOCK, ROWLOCK) WHERE bill_id = ?");
    $stmt->execute([$billId]);
    $invoice = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$invoice) {
        throw new RuntimeException('Invoice not found.');
    }

    if (!in_array(strtolower((string) $invoice['status']), ['pending', 'partial'], true)) {
        throw new RuntimeException('Only pending or partially paid invoices can accept further partial payment.');
    }

    $selected = [];
    foreach ($selectedItems as $item) {
        $attendanceId = $item['attendance_id'] ?? null;
        $amount = (float) ($item['amount'] ?? 0);
        if ($amount <= 0) {
            continue;
        }
        $selected[] = [
            'attendance_id' => $attendanceId !== null && $attendanceId !== '' ? (int) $attendanceId : null,
            'amount' => $amount,
        ];
    }

    if (!$selected) {
        throw new RuntimeException('Select at least one invoice line to apply a partial payment.');
    }

    $billTotal = (float) ($invoice['total_amount'] ?? 0);
    $selectedTotal = 0.0;

    foreach ($selected as $entry) {
        $attendanceId = $entry['attendance_id'];
        $requestedAmount = (float) $entry['amount'];
        $selectedTotal += $requestedAmount;

        if ($attendanceId !== null) {
            $lineStmt = $conn->prepare("SELECT TOP 1 bill_id, attendance_id, amount FROM dbo.billing_records WITH (UPDLOCK, ROWLOCK) WHERE bill_id = ? AND attendance_id = ?");
            $lineStmt->execute([$billId, $attendanceId]);
            $line = $lineStmt->fetch(PDO::FETCH_ASSOC);

            if (!$line) {
                continue;
            }

            $currentAmount = (float) ($line['amount'] ?? 0);
            $remainingAmount = max(0.0, $currentAmount - $requestedAmount);

            if ($remainingAmount > 0) {
                $updateLine = $conn->prepare("UPDATE dbo.billing_records SET amount = ? WHERE bill_id = ? AND attendance_id = ?");
                $updateLine->execute([$remainingAmount, $billId, $attendanceId]);
            } else {
                $deleteLine = $conn->prepare("DELETE FROM dbo.billing_records WHERE bill_id = ? AND attendance_id = ?");
                $deleteLine->execute([$billId, $attendanceId]);

                $updatePayment = $conn->prepare(
                    "UPDATE dbo.payments
                     SET payment_status = 'paid', confirmed_at = GETDATE(), confirmed_by = ?, rejection_reason = NULL
                     WHERE attendance_id = ? AND payment_status IN ('billed','pending')"
                );
                $updatePayment->execute([$adminId, $attendanceId]);
            }
        } else {
            $lineStmt = $conn->prepare("SELECT TOP 1 bill_id, attendance_id, amount FROM dbo.billing_records WITH (UPDLOCK, ROWLOCK) WHERE bill_id = ? AND attendance_id IS NULL");
            $lineStmt->execute([$billId]);
            $line = $lineStmt->fetch(PDO::FETCH_ASSOC);

            if (!$line) {
                continue;
            }

            $currentAmount = (float) ($line['amount'] ?? 0);
            $remainingAmount = max(0.0, $currentAmount - $requestedAmount);

            if ($remainingAmount > 0) {
                $updateLine = $conn->prepare("UPDATE dbo.billing_records SET amount = ? WHERE bill_id = ? AND attendance_id IS NULL");
                $updateLine->execute([$remainingAmount, $billId]);
            } else {
                $deleteLine = $conn->prepare("DELETE FROM dbo.billing_records WHERE bill_id = ? AND attendance_id IS NULL");
                $deleteLine->execute([$billId]);

                $memberId = (int) ($invoice['member_id'] ?? 0);
                $walkInId = (int) ($invoice['walk_in_id'] ?? 0);
                $promoUpdate = $conn->prepare(
                    "UPDATE dbo.payments
                     SET payment_status = 'paid', confirmed_at = GETDATE(), confirmed_by = ?, rejection_reason = NULL
                     WHERE ((member_id = ? AND member_id IS NOT NULL) OR (walk_in_id = ? AND walk_in_id IS NOT NULL))
                       AND payment_type = 'PROMOTION' AND attendance_id IS NULL AND payment_status IN ('billed','pending')"
                );
                $promoUpdate->execute([$adminId, $memberId, $walkInId]);
            }
        }
    }

    if ($selectedTotal <= 0 || $selectedTotal > $billTotal) {
        throw new RuntimeException('Selected partial payment exceeds the invoice total.');
    }

    $remainingStmt = $conn->prepare("SELECT COALESCE(SUM(amount), 0) FROM dbo.billing_records WHERE bill_id = ?");
    $remainingStmt->execute([$billId]);
    $remainingAmount = (float) $remainingStmt->fetchColumn();

    $remainingStatus = $remainingAmount > 0 ? 'partial' : 'paid';
    $updateInvoice = $conn->prepare(
        "UPDATE dbo.bill_details SET total_amount = ?, status = ?, resolved_at = " . ($remainingAmount > 0 ? "NULL" : "GETDATE()") . " WHERE bill_id = ?"
    );
    $updateInvoice->execute([$remainingAmount, $remainingStatus, $billId]);

    $message = $remainingAmount > 0
        ? 'Partial payment applied. The remaining balance is still pending.'
        : 'Partial payment completed and the invoice has been fully settled.';

    return [
        'selected_total' => $selectedTotal,
        'remaining_total' => $remainingAmount,
        'status' => $remainingStatus,
        'message' => $message,
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$conn = getConnection();
auditAdminAction($conn, $authUser, $action);

try {
    ensureBillingSchema($conn);

    if ($action === 'process_overdue') {
        $days = normalizeDays($_GET['days'] ?? 14);

        $created = processOverdue($conn, $days);
        syncBillingStatuses($conn);

        echo json_encode([
            'success' => true,
            'message' => $created > 0
                ? "{$created} attendance line(s) added to member invoice(s)."
                : 'Billing check completed. No new overdue records were found.',
            'created' => $created,
            'threshold_days' => $days,
        ]);
        exit;
    }

    if ($action === 'get_records') {
        $days = normalizeDays($_GET['days'] ?? 14);
        $status = strtolower(trim($_GET['status'] ?? 'all'));
        $search = trim($_GET['search'] ?? '');
        $memberId = max(0, (int) ($_GET['member_id'] ?? 0));


        processOverdue($conn, $days);
        syncBillingStatuses($conn);

        $records = getBillingInvoices($conn, $status, $search, $memberId);

        $statsSql = "
            SELECT
                COUNT(*) AS total_records,
                SUM(CASE WHEN status IN ('pending', 'partial') THEN 1 ELSE 0 END) AS open_records,
                COALESCE(SUM(CASE WHEN status IN ('pending', 'partial') THEN total_amount ELSE 0 END), 0) AS open_amount,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_records,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) AS paid_amount
            FROM dbo.bill_details
        ";
        if ($memberId > 0) $statsSql .= ' WHERE member_id = ?';
        $statsStmt = $conn->prepare($statsSql);
        $statsStmt->execute($memberId > 0 ? [$memberId] : []);
        $stats = $statsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        echo json_encode([
            'success' => true,
            'records' => $records,
            'invoices' => $records,
            'stats' => [
                'total_records' => (int) ($stats['total_records'] ?? 0),
                'open_records' => (int) ($stats['open_records'] ?? 0),
                'open_amount' => (float) ($stats['open_amount'] ?? 0),
                'paid_records' => (int) ($stats['paid_records'] ?? 0),
                'paid_amount' => (float) ($stats['paid_amount'] ?? 0),
            ],
            'threshold_days' => $days,
        ]);
        exit;
    }

    if ($action === 'get_record') {
        $billId = (int) ($_GET['bill_id'] ?? $_GET['billing_id'] ?? 0);

        if ($billId <= 0) {
            echo json_encode([
                'success' => false,
            'message' => 'Bill ID is required.'
            ]);
            exit;
        }

        syncBillingStatuses($conn);

        $stmt = $conn->prepare("SELECT bd.*, COALESCE(m.full_name,w.client_name,'Unknown member') AS member_name,
            COALESCE(m.email,w.email) AS member_email, m.phone AS member_phone
            FROM dbo.bill_details bd
            LEFT JOIN dbo.members m ON m.memberID=bd.member_id
            LEFT JOIN dbo.walk_in_records w ON w.id=bd.walk_in_id
            WHERE bd.bill_id=?");
        $stmt->execute([$billId]);
        $invoice = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$invoice) {
            echo json_encode([
                'success' => false,
                'message' => 'Invoice not found.'
            ]);
            exit;
        }

        $linesStmt = $conn->prepare("SELECT br.bill_id, br.attendance_id, br.amount,
            CASE WHEN br.attendance_id IS NULL THEN 'Promotion / walk-in charge' ELSE ar.sessions END AS description,
            ar.attendance_date, ar.payment_method,
            (SELECT COUNT(*) FROM dbo.payments p WHERE p.attendance_id=br.attendance_id) AS payment_count
            FROM dbo.billing_records br
            LEFT JOIN dbo.attendance_records ar ON ar.id=br.attendance_id
            WHERE br.bill_id=? ORDER BY ar.attendance_date, br.attendance_id");
        $linesStmt->execute([$billId]);
        $lines = $linesStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'invoice' => $invoice,
            'lines' => $lines,
            'record' => $invoice
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'send_notice') {
        $input = json_decode(file_get_contents('php://input'), true);
        $billId = (int) ($input['bill_id'] ?? $input['billing_id'] ?? 0);
        if ($billId <= 0) {
            throw new InvalidArgumentException('Bill ID is required.');
        }

        $result = sendBillingNotice($conn, $billId, (int) ($authUser['sub'] ?? 0));
        auditAdminActionDetail($conn, $authUser, $action, 'sent billing notice to ' . $result['member_name']);
        echo json_encode([
            'success' => true,
            'message' => $result['email_sent']
                ? 'Payment notice sent by email and member notification.'
                : 'Payment notice added to the member notification center. Email is not configured.',
            'email_sent' => $result['email_sent'],
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'mark_paid') {
        $input = json_decode(file_get_contents('php://input'), true);
        $billId = (int) ($input['bill_id'] ?? $input['billing_id'] ?? 0);
        if ($billId <= 0) {
            throw new InvalidArgumentException('Bill ID is required.');
        }

        $conn->beginTransaction();
        markBillingPaid($conn, $billId, (int) ($authUser['sub'] ?? 0));
        $conn->commit();

        $memberNameStmt = $conn->prepare('SELECT COALESCE(m.full_name,w.client_name) FROM dbo.bill_details bd LEFT JOIN dbo.members m ON m.memberID=bd.member_id LEFT JOIN dbo.walk_in_records w ON w.id=bd.walk_in_id WHERE bd.bill_id=?');
        $memberNameStmt->execute([$billId]);
        auditAdminActionDetail($conn, $authUser, $action, 'marked billing paid for ' . (string)$memberNameStmt->fetchColumn());

        echo json_encode([
            'success' => true,
            'message' => 'Payment marked as paid and member records updated.',
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'partial_payment') {
        $input = json_decode(file_get_contents('php://input'), true);
        $billId = (int) ($input['bill_id'] ?? $input['billing_id'] ?? 0);
        $selected = is_array($input['selected'] ?? null) ? $input['selected'] : [];

        if ($billId <= 0) {
            throw new InvalidArgumentException('Bill ID is required.');
        }

        $conn->beginTransaction();
        $result = partialBillingPayment($conn, $billId, (int) ($authUser['sub'] ?? 0), $selected);
        $conn->commit();

        $memberNameStmt = $conn->prepare('SELECT COALESCE(m.full_name,w.client_name) FROM dbo.bill_details bd LEFT JOIN dbo.members m ON m.memberID=bd.member_id LEFT JOIN dbo.walk_in_records w ON w.id=bd.walk_in_id WHERE bd.bill_id=?');
        $memberNameStmt->execute([$billId]);
        auditAdminActionDetail($conn, $authUser, $action, 'applied partial payment for ' . (string)$memberNameStmt->fetchColumn());

        echo json_encode([
            'success' => true,
            'message' => $result['message'],
            'selected_total' => $result['selected_total'],
            'remaining_total' => $result['remaining_total'],
            'status' => $result['status'],
        ]);
        exit;
    }

    echo json_encode([
        'success' => false,
        'message' => 'Invalid billing action.'
    ]);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof PDO) {
        auditSystemError($conn, 'Billing API', $e);
    }
    error_log('Billing API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Billing service error: ' . $e->getMessage()
    ]);
}
?>
