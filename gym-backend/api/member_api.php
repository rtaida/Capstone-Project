<?php
header('Content-Type: application/json');

header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function getConnection()
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
        echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
        exit;
    }
}


function ensureSessionCatalog(PDO $conn)
{
    $conn->exec("IF OBJECT_ID(N'dbo.gym_session_types', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.gym_session_types (
            id INT IDENTITY(1,1) PRIMARY KEY,
            session_name NVARCHAR(100) NOT NULL UNIQUE,
            price DECIMAL(10,2) NOT NULL,
            is_active BIT NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT GETDATE(),
            updated_at DATETIME NOT NULL DEFAULT GETDATE(),
            CONSTRAINT CK_gym_session_types_price CHECK (price >= 0)
        );
    END");

    $seeds = [
        ['Regular Session', 50],
        ['Weight Lifting', 200],
        ['Boxing', 200],
        ['Personal Trainer', 200],
    ];

    $stmt = $conn->prepare(
        "IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = ?)
         INSERT INTO dbo.gym_session_types (session_name, price)
         VALUES (?, ?)"
    );

    foreach ($seeds as [$name, $price]) {
        $stmt->execute([$name, $name, $price]);
    }
}

function ensureMemberProfilePhotoColumn(PDO $conn): void
{
    if (!$conn->query("SELECT COL_LENGTH('dbo.members', 'profile_photo')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.members ADD profile_photo NVARCHAR(500) NULL");
    }
}

function resolvePublicOrigin(): array
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
    if ($origin !== '') {
        $parsed = parse_url($origin);
        if (!empty($parsed['scheme']) && !empty($parsed['host'])) {
            return [$parsed['scheme'], $parsed['host']];
        }
    }

    $forwardedProto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    $forwardedHost = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost';
    $proto = strtolower((string) strtok((string) $forwardedProto, ','));

    $scheme = $proto !== '' ? $proto : ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http');
    $host = preg_replace('#^https?://#', '', $forwardedHost);

    return [$scheme, $host];
}

function buildAppBaseUrl(string $path = ''): string
{
    $result = '/' . ltrim((string) $path, '/');
    $result = preg_replace('#^/(?:Capstone%20Project|Capstone Project)/gym-backend#i', '', $result);
    return $result === '' ? '/' : $result;
}

function normalizeAssetUrl(?string $value): ?string
{
    if ($value === null || trim((string) $value) === '') {
        return null;
    }

    $normalized = trim((string) $value);
    if ($normalized === '') {
        return null;
    }

    if (preg_match('#^data:image/#i', $normalized)) {
        return $normalized;
    }

    $assetPath = $normalized;
    if (preg_match('#^https?://#i', $normalized)) {
        $assetPath = preg_replace('#^https?://[^/]+#i', '', $normalized);
    }

    $assetPath = preg_replace('#^/(?:Capstone%20Project|Capstone Project)/gym-backend#i', '', $assetPath);
    $assetPath = preg_replace('#^/(?:Capstone%20Project|Capstone Project)#i', '', $assetPath);

    if (preg_match('#^/#', $assetPath)) {
        return $assetPath;
    }

    if (preg_match('#^(?:profile_uploads|qrcodes|[A-Za-z0-9_./%-]+)$#i', $assetPath)) {
        return '/' . ltrim($assetPath, '/');
    }

    return $normalized;
}

function normalizeMemberRecord(array $member): array
{
    if (isset($member['profile_photo'])) {
        $member['profile_photo'] = normalizeAssetUrl($member['profile_photo']);
    }
    if (isset($member['qr_code'])) {
        $member['qr_code'] = normalizeAssetUrl($member['qr_code']);
    }
    return $member;
}

function saveMemberProfilePhoto(string $dataUrl, int $memberId): ?string
{
    if ($dataUrl === '' || str_starts_with($dataUrl, 'http://') || str_starts_with($dataUrl, 'https://')) return null;
    if (!preg_match('/^data:image\/(jpeg|png|webp);base64,(.+)$/', $dataUrl, $matches)) {
        throw new InvalidArgumentException('Please upload a JPG, PNG, or WebP image.');
    }
    $image = base64_decode($matches[2], true);
    if ($image === false || strlen($image) > 5 * 1024 * 1024) {
        throw new InvalidArgumentException('Profile photo must be 5 MB or smaller.');
    }
    $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
    $directory = __DIR__ . '/../profile_uploads/';
    if (!is_dir($directory)) mkdir($directory, 0777, true);
    $fileName = 'member_' . $memberId . '_' . time() . '.' . $extension;
    file_put_contents($directory . $fileName, $image);
    return buildAppBaseUrl('profile_uploads/' . $fileName);
}


$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';
require_once __DIR__ . '/config/auth.php';
require_once __DIR__ . '/config/audit.php';
require_once __DIR__ . '/config/member_identity.php';
require_once __DIR__ . '/config/billing_schema.php';

function ensurePaymentBilledStatus(PDO $conn): void
{
    try {
        $tableExists = (int) $conn->query("SELECT CASE WHEN OBJECT_ID(N'dbo.payments', N'U') IS NOT NULL THEN 1 ELSE 0 END")->fetchColumn();
        if ($tableExists !== 1) {
            return;
        }

        $constraintExists = (int) $conn->query("SELECT CASE WHEN EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE name = N'CK_payments_status'
              AND parent_object_id = OBJECT_ID(N'dbo.payments')
        ) THEN 1 ELSE 0 END")->fetchColumn();

        if ($constraintExists === 1) {
            try {
                $conn->exec('ALTER TABLE dbo.payments DROP CONSTRAINT [CK_payments_status];');
            } catch (Throwable $e) {
                $msg = strtolower($e->getMessage());
                if (strpos($msg, 'is not a constraint') === false && strpos($msg, 'does not exist') === false && strpos($msg, 'not found') === false) {
                    throw $e;
                }
            }
        }

        try {
            $conn->exec("ALTER TABLE dbo.payments WITH CHECK ADD CONSTRAINT [CK_payments_status] CHECK (payment_status IN ('pending','paid','billed','rejected','voided','refunded')); ");
        } catch (Throwable $e) {
            $msg = strtolower($e->getMessage());
            if (strpos($msg, 'already an object named') === false && strpos($msg, 'already exists') === false && strpos($msg, 'is not a constraint') === false) {
                throw $e;
            }
        }
    } catch (Throwable $e) {
        error_log('Payment status migration check failed: ' . $e->getMessage());
        throw $e;
    }
}

function processOverduePayments(PDO $conn, int $thresholdDays = 7): int
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

    $ownsTransaction = !$conn->inTransaction();
    if ($ownsTransaction) $conn->beginTransaction();
    try {
        $grouped = [];
        foreach ($payments as $payment) {
            $memberId = $payment['member_id'] !== null ? (int) $payment['member_id'] : null;
            $walkInId = $payment['walk_in_id'] !== null ? (int) $payment['walk_in_id'] : null;
            $ownerKey = $memberId !== null ? 'member:' . $memberId : 'walkin:' . $walkInId;
            $attendanceKey = $payment['attendance_id'] !== null ? (string) (int) $payment['attendance_id'] : 'non-attendance';
            $grouped[$ownerKey]['member_id'] = $memberId;
            $grouped[$ownerKey]['walk_in_id'] = $walkInId;
            $grouped[$ownerKey]['lines'][$attendanceKey][] = $payment;
        }
        $markBilled = $conn->prepare("UPDATE dbo.payments SET payment_status='billed', confirmed_at=NULL, confirmed_by=NULL, rejection_reason=NULL WHERE payment_id=? AND payment_status='pending'");
        $created = 0;
        foreach ($grouped as $owner) {
            $billId = getOrCreatePendingBill($conn, $owner['member_id'], $owner['walk_in_id'], null, 'Overdue gym and promotion charges');
            foreach ($owner['lines'] as $attendanceKey => $attendancePayments) {
                $amount = array_sum(array_map(static fn($row) => (float) $row['amount'], $attendancePayments));
                $attendanceId = $attendanceKey === 'non-attendance' ? null : (int) $attendanceKey;
                addBillingAttendanceAmount($conn, $billId, $attendanceId, $amount);
                $created++;
                foreach ($attendancePayments as $payment) $markBilled->execute([(int) $payment['payment_id']]);
            }
        }
        if ($ownsTransaction) $conn->commit();
        return $created;
    } catch (Throwable $e) {
        if ($ownsTransaction && $conn->inTransaction()) $conn->rollBack();
        throw $e;
    }
}

try {
    $conn = getConnection();
    ensureMemberProfilePhotoColumn($conn);
    ensureMemberIdentitySchema($conn);
    ensureBillingSchema($conn);
    $conn->exec("IF OBJECT_ID(N'dbo.walk_in_records', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.walk_in_records') AND name=N'email') ALTER TABLE dbo.walk_in_records ADD email NVARCHAR(255) NULL");
    $adminActions = [
        'get',
        'add',
        'update',
        'delete',
        'restore',
        'generate_qr',
        'search',
        'get_deleted',  
        'get_pending_members',
        'approve_member',
        'reject_member',
        'get_payments',
        'confirm_payment',
        'bill_payment',
        'reject_payment',
        'create_walk_in',
        'record_attendance',
        'get_walk_ins',
        'get_revenue',
        'get_all_sessions',
        'get_attendance'
    ];
    $memberActions = ['update_profile', 'sync_member', 'get_one', 'get_current_booked_session', 'get_attendance'];
    $authUser = requireActionRole($action, $adminActions, [], $memberActions);
    ensurePaymentBilledStatus($conn);
    if ($action === 'get_attendance' && strtolower((string) ($authUser['role'] ?? '')) === 'member') {
        $requested = (int) ($input['member_id'] ?? $_GET['member_id'] ?? 0);
        if ($requested !== (int) $authUser['sub'])
            authError('You can only view your own attendance.');
    }
    if (in_array($action, ['update_profile', 'sync_member', 'get_one', 'get_current_booked_session'], true) && strtolower((string) ($authUser['role'] ?? '')) === 'member') {
        $requested = (int) ($input['member_id'] ?? $input['id'] ?? $_POST['member_id'] ?? $_GET['member_id'] ?? $_GET['id'] ?? 0);
        if ($requested !== (int) $authUser['sub'])
            authError('You can only access your own member account.');
    }




    if ($method === 'GET' && ($action === 'get' || $action === '')) {
        $sql = "SELECT m.memberID, m.full_name, m.first_name, m.last_name, m.middle_initial, m.email, m.phone, m.weight, m.height, m.age, m.date_of_birth, m.gender, m.payment_method, m.status, m.created_at, m.qr_code, m.profile_photo,
                   (SELECT COUNT(*) FROM attendance_records ar WHERE ar.member_id = m.memberID) AS check_in_count
            FROM members m
            WHERE m.deleted_at IS NULL
            ORDER BY m.memberID DESC";
        $stmt = $conn->query($sql);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $today = new DateTimeImmutable('today');
        foreach ($members as &$member) {
            if (!empty($member['date_of_birth'])) {
                try {
                    $member['age'] = (int) (new DateTimeImmutable((string) $member['date_of_birth']))->diff($today)->y;
                } catch (Exception $e) {
                    // Keep the stored age when a legacy birthdate is malformed.
                }
            }
        }
        unset($member);

        echo json_encode([
            'success' => true,
            'members' => $members
        ]);
        exit;
    }




    if ($method === 'POST' && $action === 'add') {
        [$first_name, $last_name, $middle_initial] = memberNamePartsFromInput($input);
        $full_name = buildMemberFullName($first_name, $last_name, $middle_initial);
        $email = $input['email'] ?? '';
        $phone = $input['phone'] ?? '';
        $weight = $input['weight'] ?? '';
        $height = $input['height'] ?? '';
        $date_of_birth = trim((string) ($input['date_of_birth'] ?? ''));
        $birthDate = DateTime::createFromFormat('!Y-m-d', $date_of_birth);
        $birthDateErrors = DateTime::getLastErrors();
        $birthDateIsValid = $birthDate && (!$birthDateErrors || ($birthDateErrors['warning_count'] === 0 && $birthDateErrors['error_count'] === 0)) && $birthDate->format('Y-m-d') === $date_of_birth;
        $age = $birthDateIsValid ? $birthDate->diff(new DateTime('today'))->y : null;
        $gender = $input['gender'] ?? 'Male';
        $status = $input['status'] ?? 'active';
        $password = $input['password'] ?? 'member123';
        $payment_method = $input['payment_method'] ?? 'Cash';

        if ($first_name === '' || $last_name === '' || empty($email)) {
            echo json_encode(['success' => false, 'message' => 'First name, last name, and email are required']);
            exit;
        }
        $nameError = memberNamePartsValidationMessage($first_name, $last_name, $middle_initial);
        if ($nameError !== null) {
            echo json_encode(['success' => false, 'message' => $nameError]);
            exit;
        }

        if (empty(trim((string) $phone))) {
            echo json_encode(['success' => false, 'message' => 'Contact number is required']);
            exit;
        }

        if (!preg_match('/^09\d{9}$/', trim((string) $phone))) {
            echo json_encode(['success' => false, 'message' => 'Invalid contact number. Use an 11-digit Philippine mobile number starting with 09.']);
            exit;
        }

        if (!$birthDateIsValid || $age < 12 || $age > 120) {
            echo json_encode(['success' => false, 'message' => 'Enter a valid birthdate for an age between 12 and 120']);
            exit;
        }


        $duplicateMessage = memberIdentityDuplicateMessage($conn, $email, $first_name, $last_name, $middle_initial);
        if ($duplicateMessage !== null) {
            echo json_encode(['success' => false, 'message' => $duplicateMessage]);
            exit;
        }


        $passwordHash = password_hash((string) $password, PASSWORD_DEFAULT);
        $sql = "INSERT INTO members (full_name, first_name, last_name, middle_initial, email, phone, weight, height, age, date_of_birth, gender, status, password, payment_method, approval_status, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'member', GETDATE())";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$full_name, $first_name, $last_name, $middle_initial, $email, $phone, $weight, $height, $age, $date_of_birth, $gender, $status, $passwordHash, $payment_method]);


        $result = $conn->query("SELECT @@IDENTITY as last_id");
        $row = $result->fetch(PDO::FETCH_ASSOC);
        $result->closeCursor();
        $newId = $row['last_id'];




        $qrDir = __DIR__ . '/../qrcodes/';
        if (!file_exists($qrDir)) {
            mkdir($qrDir, 0777, true);
        }

        $baseUrl = buildAppBaseUrl('qrcodes/');
        $qrFileName = 'qr_' . $newId . '_' . time() . '.png';
        $qrFilePath = $qrDir . $qrFileName;

        $qrData = json_encode([
            'member_id' => $newId,
            'full_name' => $full_name,
            'timestamp' => date('Y-m-d H:i:s')
        ]);


        $qrCodeUrlApi = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' . urlencode($qrData);
        $qrImage = @file_get_contents($qrCodeUrlApi);

        $qrFileUrl = null;

        if ($qrImage !== false) {
            file_put_contents($qrFilePath, $qrImage);
            $qrFileUrl = $baseUrl . $qrFileName;


            $updateSql = "UPDATE members SET qr_code = ? WHERE memberID = ?";
            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->execute([$qrFileUrl, $newId]);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Member added successfully',
            'member_id' => $newId,
            'qr_code' => $qrFileUrl
        ]);
        auditAdminActionDetail($conn, $authUser, $action, "added member {$full_name}");
        exit;
    }




    if ($method === 'POST' && $action === 'update_profile') {
        $member_id = $input['member_id'] ?? '';
        $member_id = (int) $member_id;
        [$first_name, $last_name, $middle_initial] = memberNamePartsFromInput($input);
        $full_name = buildMemberFullName($first_name, $last_name, $middle_initial);
        $email = $input['email'] ?? '';
        $phone = $input['phone'] ?? '';
        $weight = $input['weight'] ?? '';
        $height = $input['height'] ?? '';
        $age = $input['age'] ?? null;
        $gender = $input['gender'] ?? '';
        $payment_method = $input['payment_method'] ?? 'Cash';
        $profile_photo = saveMemberProfilePhoto(trim((string) ($input['profile_photo'] ?? '')), $member_id);

        if (empty($member_id) || $first_name === '' || $last_name === '' || empty($email)) {
            echo json_encode(['success' => false, 'message' => 'Member ID, first name, last name, and email are required']);
            exit;
        }
        $nameError = memberNamePartsValidationMessage($first_name, $last_name, $middle_initial);
        if ($nameError !== null) {
            echo json_encode(['success' => false, 'message' => $nameError]);
            exit;
        }

        $duplicateMessage = memberIdentityDuplicateMessage($conn, $email, $first_name, $last_name, $middle_initial, $member_id);
        if ($duplicateMessage !== null) {
            echo json_encode(['success' => false, 'message' => $duplicateMessage]);
            exit;
        }

        $sql = "UPDATE members SET 
                full_name = ?, first_name = ?, last_name = ?, middle_initial = ?,
                email = ?, 
                phone = ?, 
                weight = ?, 
                height = ?, 
                age = ?,
                gender = ?, 
                payment_method = ?" . ($profile_photo !== null ? ", profile_photo = ?" : "") . "
                WHERE memberID = ? AND deleted_at IS NULL";
        $stmt = $conn->prepare($sql);
            $params = [$full_name, $first_name, $last_name, $middle_initial, $email, $phone, $weight, $height, $age, $gender, $payment_method];
            if ($profile_photo !== null) $params[] = $profile_photo;
            $params[] = $member_id;
            $stmt->execute($params);

        echo json_encode([
            'success' => true,
            'message' => 'Profile updated successfully',
            'profile_photo' => $profile_photo
        ]);
        exit;
    }




    if ($method === 'POST' && $action === 'update') {
        $member_id = $input['member_id'] ?? '';
        $member_id = (int) $member_id;
        [$first_name, $last_name, $middle_initial] = memberNamePartsFromInput($input);
        $full_name = buildMemberFullName($first_name, $last_name, $middle_initial);
        $email = $input['email'] ?? '';
        $phone = $input['phone'] ?? '';
        $weight = $input['weight'] ?? '';
        $height = $input['height'] ?? '';
        $date_of_birth = trim((string) ($input['date_of_birth'] ?? ''));
        $birthDate = $date_of_birth !== '' ? DateTime::createFromFormat('!Y-m-d', $date_of_birth) : false;
        $birthDateErrors = DateTime::getLastErrors();
        $birthDateIsValid = $birthDate && (!$birthDateErrors || ($birthDateErrors['warning_count'] === 0 && $birthDateErrors['error_count'] === 0)) && $birthDate->format('Y-m-d') === $date_of_birth;
        $age = $birthDateIsValid ? $birthDate->diff(new DateTime('today'))->y : ($input['age'] ?? null);
        $date_of_birth = $birthDateIsValid ? $date_of_birth : null;
        $gender = $input['gender'] ?? 'Male';
        $status = $input['status'] ?? 'active';
        $password = $input['password'] ?? null;
        $payment_method = $input['payment_method'] ?? 'Cash';

        if (empty($member_id) || $first_name === '' || $last_name === '' || empty($email)) {
            echo json_encode(['success' => false, 'message' => 'Member ID, first name, last name, and email are required']);
            exit;
        }
        $nameError = memberNamePartsValidationMessage($first_name, $last_name, $middle_initial);
        if ($nameError !== null) {
            echo json_encode(['success' => false, 'message' => $nameError]);
            exit;
        }

        if ($input['date_of_birth'] ?? null) {
            if (!$birthDateIsValid || $age < 12 || $age > 120) {
                echo json_encode(['success' => false, 'message' => 'Enter a valid birthdate for an age between 12 and 120']);
                exit;
            }
        }


        $duplicateMessage = memberIdentityDuplicateMessage($conn, $email, $first_name, $last_name, $middle_initial, $member_id);
        if ($duplicateMessage !== null) {
            echo json_encode(['success' => false, 'message' => $duplicateMessage]);
            exit;
        }

        $beforeStmt = $conn->prepare('SELECT full_name, email, phone, weight, height, age, date_of_birth, gender, status, payment_method FROM members WHERE memberID = ? AND deleted_at IS NULL');
        $beforeStmt->execute([$member_id]);
        $before = $beforeStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        if (!empty($password)) {
            $sql = "UPDATE members SET 
                    full_name = ?, first_name = ?, last_name = ?, middle_initial = ?,
                    email = ?, 
                    phone = ?, 
                    weight = ?, 
                    height = ?, 
                    age = ?,
                    date_of_birth = ?,
                    gender = ?, 
                    status = ?,
                    password = ?,
                    payment_method = ? 
                    WHERE memberID = ? AND deleted_at IS NULL";
            $stmt = $conn->prepare($sql);
                $stmt->execute([$full_name, $first_name, $last_name, $middle_initial, $email, $phone, $weight, $height, $age, $date_of_birth, $gender, $status, $password, $payment_method, $member_id]);
        } else {
            $sql = "UPDATE members SET 
                    full_name = ?, first_name = ?, last_name = ?, middle_initial = ?,
                    email = ?, 
                    phone = ?, 
                    weight = ?, 
                    height = ?, 
                    age = ?,
                    date_of_birth = ?,
                    gender = ?, 
                    status = ?,
                    payment_method = ? 
                    WHERE memberID = ? AND deleted_at IS NULL";
            $stmt = $conn->prepare($sql);
            $stmt->execute([$full_name, $first_name, $last_name, $middle_initial, $email, $phone, $weight, $height, $age, $date_of_birth, $gender, $status, $payment_method, $member_id]);
        }


        $checkQrSql = "SELECT qr_code FROM members WHERE memberID = ?";
        $checkQrStmt = $conn->prepare($checkQrSql);
        $checkQrStmt->execute([$member_id]);
        $member = $checkQrStmt->fetch(PDO::FETCH_ASSOC);
        $checkQrStmt->closeCursor();

        if (empty($member['qr_code'])) {

            $qrDir = __DIR__ . '/../qrcodes/';
            if (!file_exists($qrDir)) {
                mkdir($qrDir, 0777, true);
            }

            $baseUrl = buildAppBaseUrl('qrcodes/');
            $qrFileName = 'qr_' . $member_id . '_' . time() . '.png';
            $qrFilePath = $qrDir . $qrFileName;

            $qrData = json_encode([
                'member_id' => $member_id,
                'full_name' => $full_name,
                'timestamp' => date('Y-m-d H:i:s')
            ]);

            $qrCodeUrlApi = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' . urlencode($qrData);
            $qrImage = @file_get_contents($qrCodeUrlApi);

            if ($qrImage !== false) {
                file_put_contents($qrFilePath, $qrImage);
                $qrFileUrl = $baseUrl . $qrFileName;

                $updateQrSql = "UPDATE members SET qr_code = ? WHERE memberID = ?";
                $updateQrStmt = $conn->prepare($updateQrSql);
                $updateQrStmt->execute([$qrFileUrl, $member_id]);
            }
        }

        echo json_encode([
            'success' => true,
            'message' => 'Member updated successfully'
        ]);
        $changed = auditChangedFields($before, [
            'full_name' => $full_name, 'email' => $email, 'phone' => $phone,
            'weight' => $weight, 'height' => $height, 'age' => $age,
            'gender' => $gender, 'status' => $status, 'payment_method' => $payment_method,
        ], [
            'full_name' => 'full name', 'email' => 'email', 'phone' => 'phone number',
            'weight' => 'weight', 'height' => 'height', 'age' => 'age',
            'gender' => 'gender', 'status' => 'status', 'payment_method' => 'payment method',
        ]);
        if (!empty($password)) $changed[] = 'password';
        auditAdminActionDetail($conn, $authUser, $action, "updated member {$full_name}" . ($changed ? ': changed ' . implode(', ', $changed) : ''));
        exit;
    }




    if ($method === 'POST' && $action === 'delete') {
        $member_id = $input['member_id'] ?? '';
        $member_id = (int) $member_id;

        if (empty($member_id)) {
            echo json_encode(['success' => false, 'message' => 'Member ID is required']);
            exit;
        }


        $sql = "UPDATE members SET deleted_at = GETDATE() WHERE memberID = ? AND deleted_at IS NULL";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$member_id]);

        echo json_encode([
            'success' => true,
            'message' => 'Member deactivated successfully'
        ]);
        $nameStmt = $conn->prepare('SELECT full_name FROM members WHERE memberID = ?');
        $nameStmt->execute([$member_id]);
        auditAdminActionDetail($conn, $authUser, $action, 'deactivated member ' . (string)$nameStmt->fetchColumn());
        exit;
    }




    if ($method === 'POST' && $action === 'restore') {
        $member_id = $input['member_id'] ?? '';

        if (empty($member_id)) {
            echo json_encode(['success' => false, 'message' => 'Member ID is required']);
            exit;
        }


        $sql = "UPDATE members SET deleted_at = NULL WHERE memberID = ?";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$member_id]);

        echo json_encode([
            'success' => true,
            'message' => 'Member restored successfully'
        ]);
        $nameStmt = $conn->prepare('SELECT full_name FROM members WHERE memberID = ?');
        $nameStmt->execute([$member_id]);
        auditAdminActionDetail($conn, $authUser, $action, 'restored member ' . (string)$nameStmt->fetchColumn());
        exit;
    }




    if ($method === 'POST' && $action === 'generate_qr') {
        $member_id = $input['member_id'] ?? '';
        $full_name = $input['full_name'] ?? '';

        if (empty($member_id)) {
            echo json_encode(['success' => false, 'message' => 'Member ID is required']);
            exit;
        }

        $qrDir = __DIR__ . '/../qrcodes/';
        if (!file_exists($qrDir)) {
            mkdir($qrDir, 0777, true);
        }

        $baseUrl = buildAppBaseUrl('qrcodes/');
        $qrFileName = 'qr_' . $member_id . '_' . time() . '.png';
        $qrFilePath = $qrDir . $qrFileName;

        $qrData = json_encode([
            'member_id' => $member_id,
            'full_name' => $full_name,
            'timestamp' => date('Y-m-d H:i:s')
        ]);

        $qrCodeUrlApi = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' . urlencode($qrData);
        $qrImage = @file_get_contents($qrCodeUrlApi);

        $qrFileUrl = null;

        if ($qrImage !== false) {
            file_put_contents($qrFilePath, $qrImage);
            $qrFileUrl = $baseUrl . $qrFileName;

            $updateSql = "UPDATE members SET qr_code = ? WHERE memberID = ? AND deleted_at IS NULL";
            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->execute([$qrFileUrl, $member_id]);
        }

        if ($qrFileUrl !== null) {
            $memberName = trim((string) $full_name);
            if ($memberName === '') {
                $memberNameStmt = $conn->prepare('SELECT full_name FROM members WHERE memberID = ?');
                $memberNameStmt->execute([$member_id]);
                $memberName = (string) $memberNameStmt->fetchColumn();
            }
            auditAdminActionDetail($conn, $authUser, $action, "Generated QR code for member {$memberName}");
        }

        echo json_encode([
            'success' => true,
            'message' => 'QR Code generated successfully',
            'qr_code_url' => $qrFileUrl
        ]);
        exit;
    }




    if ($method === 'GET' && $action === 'search') {
        $searchTerm = isset($_GET['q']) ? '%' . $_GET['q'] . '%' : '';

        $sql = "SELECT memberID, full_name, email, phone, weight, height, age, gender, payment_method, status, created_at, qr_code 
                FROM members 
                WHERE (full_name LIKE ? OR email LIKE ? OR phone LIKE ?) 
                AND deleted_at IS NULL
                ORDER BY memberID DESC";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$searchTerm, $searchTerm, $searchTerm]);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'members' => $members
        ]);
        exit;
    }







    if ($method === 'GET' && $action === 'sync_member') {
        $candidate_id = (int) ($_GET['id'] ?? 0);
        $email = trim($_GET['email'] ?? '');

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode([
                'success' => false,
                'message' => 'A valid member email is required for synchronization.'
            ]);
            exit;
        }


        $member = null;
        if ($candidate_id > 0) {
            $stmt = $conn->prepare(
                "SELECT memberID, full_name, email, phone, weight, height, age, gender,
                        payment_method, status, created_at, qr_code, profile_photo
                 FROM members
                 WHERE memberID = ? AND email = ? AND deleted_at IS NULL"
            );
            $stmt->execute([$candidate_id, $email]);
            $member = $stmt->fetch(PDO::FETCH_ASSOC);
            $stmt->closeCursor();
        }


        if (!$member) {
            $stmt = $conn->prepare(
                "SELECT memberID, full_name, email, phone, weight, height, age, gender,
                        payment_method, status, created_at, qr_code, profile_photo
                 FROM members
                 WHERE email = ? AND deleted_at IS NULL"
            );
            $stmt->execute([$email]);
            $member = $stmt->fetch(PDO::FETCH_ASSOC);
            $stmt->closeCursor();
        }

        if (!$member) {
            echo json_encode([
                'success' => false,
                'message' => 'Member account could not be found.'
            ]);
            exit;
        }

        $member = normalizeMemberRecord($member);
        echo json_encode([
            'success' => true,
            'member' => $member,
            'synchronized' => $candidate_id !== (int) $member['memberID']
        ]);
        exit;
    }




    if ($method === 'GET' && $action === 'get_one') {
        $member_id = (int) ($_GET['id'] ?? 0);
        $member_email = trim($_GET['email'] ?? '');



        if ($member_id > 0) {
                  $sql = "SELECT memberID, full_name, first_name, last_name, middle_initial, email, phone, weight, height, age, gender, payment_method, status, created_at, qr_code, profile_photo,
                      COALESCE((SELECT SUM(amount) FROM payments WHERE member_id = members.memberID AND payment_status = 'paid'), 0) AS paid_amount,
                      (SELECT TOP 1 p.promo_name FROM promo_availments pa INNER JOIN promotions p ON p.id = pa.promo_id WHERE pa.member_id = members.memberID AND pa.status = 'active' AND pa.expiration_date >= CAST(GETDATE() AS DATE) ORDER BY pa.expiration_date ASC) AS active_promo_name,
                      (SELECT TOP 1 pa.expiration_date FROM promo_availments pa WHERE pa.member_id = members.memberID AND pa.status = 'active' AND pa.expiration_date >= CAST(GETDATE() AS DATE) ORDER BY pa.expiration_date ASC) AS active_promo_expiration
                    FROM members
                    WHERE memberID = ? AND deleted_at IS NULL";
            $stmt = $conn->prepare($sql);
            $stmt->execute([$member_id]);
        } elseif ($member_email !== '' && filter_var($member_email, FILTER_VALIDATE_EMAIL)) {
                  $sql = "SELECT memberID, full_name, first_name, last_name, middle_initial, email, phone, weight, height, age, gender, payment_method, status, created_at, qr_code, profile_photo,
                      COALESCE((SELECT SUM(amount) FROM payments WHERE member_id = members.memberID AND payment_status = 'paid'), 0) AS paid_amount,
                      (SELECT TOP 1 p.promo_name FROM promo_availments pa INNER JOIN promotions p ON p.id = pa.promo_id WHERE pa.member_id = members.memberID AND pa.status = 'active' AND pa.expiration_date >= CAST(GETDATE() AS DATE) ORDER BY pa.expiration_date ASC) AS active_promo_name,
                      (SELECT TOP 1 pa.expiration_date FROM promo_availments pa WHERE pa.member_id = members.memberID AND pa.status = 'active' AND pa.expiration_date >= CAST(GETDATE() AS DATE) ORDER BY pa.expiration_date ASC) AS active_promo_expiration
                    FROM members
                    WHERE email = ? AND deleted_at IS NULL";
            $stmt = $conn->prepare($sql);
            $stmt->execute([$member_email]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Member ID or email is required']);
            exit;
        }

        $member = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();

        if ($member) {
            $member = normalizeMemberRecord($member);
        }

        if (!$member && $member_email !== '' && filter_var($member_email, FILTER_VALIDATE_EMAIL)) {
            $stmt = $conn->prepare(
                "SELECT memberID, full_name, first_name, last_name, middle_initial, email, phone, weight, height, age, gender, payment_method, status, created_at, qr_code, profile_photo,
                    COALESCE((SELECT SUM(amount) FROM payments WHERE member_id = members.memberID AND payment_status = 'paid'), 0) AS paid_amount,
                    (SELECT TOP 1 p.promo_name FROM promo_availments pa INNER JOIN promotions p ON p.id = pa.promo_id WHERE pa.member_id = members.memberID AND pa.status = 'active' AND pa.expiration_date >= CAST(GETDATE() AS DATE) ORDER BY pa.expiration_date ASC) AS active_promo_name,
                    (SELECT TOP 1 pa.expiration_date FROM promo_availments pa WHERE pa.member_id = members.memberID AND pa.status = 'active' AND pa.expiration_date >= CAST(GETDATE() AS DATE) ORDER BY pa.expiration_date ASC) AS active_promo_expiration
                 FROM members WHERE email = ? AND deleted_at IS NULL"
            );
            $stmt->execute([$member_email]);
            $member = $stmt->fetch(PDO::FETCH_ASSOC);
            $stmt->closeCursor();
            if ($member) {
                $member = normalizeMemberRecord($member);
            }
        }

        if ($member) {
            echo json_encode(['success' => true, 'member' => $member]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Member account could not be found.']);
        }
        exit;
    }




    if ($method === 'GET' && $action === 'get_deleted') {
        $sql = "SELECT memberID, full_name, email, phone, deleted_at 
                FROM members 
                WHERE deleted_at IS NOT NULL
                ORDER BY deleted_at DESC";
        $stmt = $conn->query($sql);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'members' => $members
        ]);
        exit;
    }




    if ($method === 'GET' && $action === 'get_current_booked_session') {
        $member_id = (int) ($_GET['member_id'] ?? 0);

        if ($member_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'Member ID is required']);
            exit;
        }

        try {
            $sql = "SELECT TOP 1
                        ts.id, ts.session_type, ts.start_time, ts.end_time, ts.price,
                        ts.trainer_id, ts.max_participants,
                        t.full_name AS trainer_name,
                        mse.status AS enrollment_status,
                        (
                            SELECT COUNT(*)
                            FROM member_session_enrollments mse2
                            WHERE mse2.session_id = ts.id
                              AND mse2.status IN ('pending', 'paid')
                        ) AS booking_count,
                        p.payment_id, p.payment_status, p.payment_method
                    FROM member_session_enrollments mse
                    INNER JOIN trainer_sessions ts ON ts.id = mse.session_id
                    LEFT JOIN trainers t ON t.trainerID = ts.trainer_id
                    OUTER APPLY (
                        SELECT TOP 1 payment_id, payment_status, payment_method
                        FROM payments p
                        WHERE p.member_id = mse.member_id
                          AND p.session_id = mse.session_id
                          AND p.payment_type = 'TRAINER_SESSION'
                                                    AND p.payment_status IN ('pending', 'paid')
                        ORDER BY CASE WHEN p.payment_status = 'pending' THEN 0 ELSE 1 END, p.payment_id DESC
                    ) p
                    WHERE mse.member_id = ?
                      AND LOWER(COALESCE(mse.status, 'pending')) IN ('pending', 'paid', 'unpaid')
                      AND (
                          LOWER(COALESCE(mse.status, 'pending')) IN ('pending', 'paid')
                          OR LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'paid')
                      )
                      AND ts.status IN ('approved', 'ongoing')
                      AND ts.end_time >= GETDATE()
                    ORDER BY
                        CASE WHEN ts.start_time <= GETDATE() AND ts.end_time >= GETDATE() THEN 0 ELSE 1 END,
                        ts.start_time ASC";

            $stmt = $conn->prepare($sql);
            $stmt->execute([$member_id]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            $stmt->closeCursor();

            if ($session) {
                $session['id'] = (int) $session['id'];
                $session['price'] = (float) $session['price'];
                $session['payment_id'] = $session['payment_id'] !== null ? (int) $session['payment_id'] : null;
            }

            echo json_encode(['success' => true, 'session' => $session ?: null]);
        } catch (PDOException $e) {
            error_log("Get current booked session error: " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Unable to load the member current booked session.']);
        }
        exit;
    }




    if ($method === 'POST' && $action === 'record_attendance') {
        $member_id = (int) ($input['member_id'] ?? 0);
        $payment_method = trim($input['payment_method'] ?? 'Cash');
        $items = is_array($input['items'] ?? null) ? $input['items'] : [];

        if ($member_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'Member ID is required']);
            exit;
        }

        if (empty($items)) {

            $items = [['type' => 'REGULAR_SESSION']];
        }

        $allowedPaymentMethods = ['Cash'];
        if (!in_array($payment_method, $allowedPaymentMethods, true)) {
            echo json_encode(['success' => false, 'message' => 'Invalid payment method']);
            exit;
        }

        try {
            $conn->beginTransaction();


            $checkMemberSql = "SELECT memberID, full_name FROM members
                               WHERE memberID = ? AND deleted_at IS NULL AND status = 'active'";
            $checkMemberStmt = $conn->prepare($checkMemberSql);
            $checkMemberStmt->execute([$member_id]);
            $memberExists = $checkMemberStmt->fetch(PDO::FETCH_ASSOC);
            $checkMemberStmt->closeCursor();

            if (!$memberExists) {
                $conn->rollBack();
                echo json_encode(['success' => false, 'message' => 'Member not found, deactivated, or inactive']);
                exit;
            }


            $today = date('Y-m-d');
            $checkSql = "SELECT COUNT(*) AS count
                         FROM attendance_records
                         WHERE member_id = ? AND CONVERT(date, attendance_date) = ?";
            $checkStmt = $conn->prepare($checkSql);
            $checkStmt->execute([$member_id, $today]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            $checkStmt->closeCursor();

            if ((int) $existing['count'] > 0) {
                $conn->rollBack();
                echo json_encode(['success' => false, 'message' => 'Member already checked in today']);
                exit;
            }

            $paymentLines = [];
            $totalAmount = 0.00;
            $sessionLabels = [];
            $seenSessionIds = [];
                        $activePromoStmt = $conn->prepare(
                                "SELECT TOP 1 pa.id, p.promo_name, pa.expiration_date
                                 FROM dbo.promo_availments pa
                                 INNER JOIN dbo.promotions p ON p.id = pa.promo_id
                                 WHERE pa.member_id = ? AND pa.status = 'active'
                                     AND pa.availed_at <= GETDATE()
                                     AND pa.expiration_date >= CAST(GETDATE() AS DATE)
                                 ORDER BY pa.expiration_date ASC"
                        );
                        $activePromoStmt->execute([$member_id]);
                        $activePromo = $activePromoStmt->fetch(PDO::FETCH_ASSOC);
                        $activePromoStmt->closeCursor();

            foreach ($items as $item) {
                $type = strtoupper(trim($item['type'] ?? ''));

                if ($type === 'REGULAR_SESSION') {

                    if ($activePromo) {
                        $paymentLines[] = [
                            'type' => 'PROMOTION',
                            'amount' => 0,
                            'session_id' => null,
                            'promo_id' => (int) $activePromo['id'],
                        ];
                        $sessionLabels[] = $activePromo['promo_name'] . ' (Promo until ' . $activePromo['expiration_date'] . ')';
                        continue;
                    }

                    ensureSessionCatalog($conn);

                    $regularPriceStmt = $conn->prepare(
                        "SELECT TOP 1 session_name, price
                         FROM dbo.gym_session_types
                         WHERE session_name = 'Regular Session'
                           AND is_active = 1"
                    );
                    $regularPriceStmt->execute();
                    $regularType = $regularPriceStmt->fetch(PDO::FETCH_ASSOC);
                    $regularPriceStmt->closeCursor();

                    if (!$regularType) {
                        throw new Exception('Regular Session pricing is not configured or is inactive.');
                    }

                    $amount = (float) $regularType['price'];
                    $paymentLines[] = [
                        'type' => 'REGULAR_SESSION',
                        'amount' => $amount,
                        'session_id' => null,
                    ];
                    $sessionLabels[] = $regularType['session_name'];
                    $totalAmount += $amount;
                    continue;
                }

                if ($type === 'TRAINER_SESSION') {
                    $session_id = (int) ($item['session_id'] ?? 0);
                    if ($session_id <= 0) {
                        throw new Exception('Invalid trainer session selected.');
                    }
                    if (isset($seenSessionIds[$session_id])) {
                        throw new Exception('A trainer session was selected more than once.');
                    }
                    $seenSessionIds[$session_id] = true;


                    $sessionSql = "SELECT ts.id, ts.session_type, ts.price, ts.status, ts.start_time, ts.end_time, ts.is_paid, ts.is_booked, ts.booked_by
                                   FROM trainer_sessions ts
                                   INNER JOIN member_session_enrollments mse
                                     ON mse.session_id = ts.id
                                    AND mse.member_id = ?
                                                                        AND LOWER(COALESCE(mse.status, 'pending')) IN ('pending', 'paid', 'unpaid')
                                                                        AND (
                                                                                LOWER(COALESCE(mse.status, 'pending')) IN ('pending', 'paid')
                                                                                OR EXISTS (
                                                                                        SELECT 1 FROM dbo.payments pending_session_payment
                                                                                        WHERE pending_session_payment.member_id = mse.member_id
                                                                                            AND pending_session_payment.session_id = mse.session_id
                                                                                            AND pending_session_payment.payment_type = 'TRAINER_SESSION'
                                                                                            AND pending_session_payment.payment_status IN ('pending', 'paid')
                                                                                )
                                                                        )
                                   WHERE ts.id = ?
                                     AND ts.status IN ('approved', 'ongoing')
                                     AND ts.end_time >= GETDATE()";
                    $sessionStmt = $conn->prepare($sessionSql);
                    $sessionStmt->execute([$member_id, $session_id]);
                    $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);
                    $sessionStmt->closeCursor();

                    if (!$session) {
                        throw new Exception('The selected trainer session is no longer available.');
                    }


                    $existingPaymentId = (int) ($item['existing_payment_id'] ?? 0);
                    $existingPayment = null;
                    $paymentLookupSql = "SELECT TOP 1 payment_id, payment_status, amount
                                         FROM payments
                                         WHERE member_id = ? AND session_id = ?
                                           AND payment_type = 'TRAINER_SESSION'
                                           AND payment_status IN ('pending','paid')
                                         ORDER BY CASE WHEN payment_status = 'pending' THEN 0 ELSE 1 END, payment_id DESC";
                    $paymentLookupStmt = $conn->prepare($paymentLookupSql);
                    $paymentLookupStmt->execute([$member_id, $session_id]);
                    $existingPayment = $paymentLookupStmt->fetch(PDO::FETCH_ASSOC);
                    $paymentLookupStmt->closeCursor();
                    if ($existingPaymentId > 0 && (!$existingPayment || (int) $existingPayment['payment_id'] !== $existingPaymentId)) {
                        throw new Exception('The booked session payment could not be verified. Please refresh and scan again.');
                    }
                    $sessionLabels[] = $session['session_type'];
                    continue;
                }

                throw new Exception('Unsupported payment item type.');
            }

            if ($totalAmount <= 0 && !$activePromo) {
                throw new Exception('Payment total must be greater than zero.');
            }

            $sessionsText = implode(', ', $sessionLabels);



            $hasOutstandingAmount = false;
            foreach ($paymentLines as $line) {
                if (($line['type'] ?? '') === 'PROMOTION') {
                    continue;
                }
                if ((float) ($line['amount'] ?? 0) > 0) {
                    $hasOutstandingAmount = true;
                    break;
                }
            }

            $attendanceStatus = !$hasOutstandingAmount ? 'paid' : 'pending';

            $attendanceSql = "INSERT INTO attendance_records
                              (member_id, payment_method, sessions, total_amount, attendance_date, payment_status)
                              VALUES (?, ?, ?, ?, GETDATE(), ?);
                              SELECT CAST(SCOPE_IDENTITY() AS INT) AS attendance_id;";
            $attendanceStmt = $conn->prepare($attendanceSql);
            $attendanceStmt->execute([$member_id, $payment_method, $sessionsText, $totalAmount, $attendanceStatus]);
            $attendanceRow = $attendanceStmt->fetch(PDO::FETCH_ASSOC);
            $attendanceStmt->closeCursor();
            $attendance_id = (int) ($attendanceRow['attendance_id'] ?? 0);

            if ($attendance_id <= 0) {
                throw new Exception('Unable to create the attendance transaction.');
            }

            foreach ($paymentLines as $line) {
                if ($line['type'] === 'PROMOTION') {
                    continue;
                }
                $paymentSql = "INSERT INTO payments
                               (member_id, payment_type, attendance_id, session_id, amount,
                                payment_method, payment_status, payment_date)
                               VALUES (?, ?, ?, ?, ?, ?, 'pending', GETDATE())";
                $paymentStmt = $conn->prepare($paymentSql);
                $paymentStmt->execute([
                    $member_id,
                    $line['type'],
                    $attendance_id,
                    $line['session_id'],
                    $line['amount'],
                    $payment_method,
                ]);
            }

            $conn->commit();

            echo json_encode([
                'success' => true,
                'message' => $activePromo
                    ? 'Check-in confirmed. Your active promotion covered the regular session fee until ' . $activePromo['expiration_date'] . '.'
                    : 'Check-in confirmed. Payment status remains subject to admin confirmation.',
                'attendance_id' => $attendance_id,
                'total_amount' => $totalAmount,
                'items' => $paymentLines,
            ]);
            $memberNameStmt = $conn->prepare('SELECT full_name FROM members WHERE memberID = ?');
            $memberNameStmt->execute([$member_id]);
            auditAdminActionDetail($conn, $authUser, $action, 'recorded attendance for ' . (string)$memberNameStmt->fetchColumn());
            exit;
        } catch (Exception $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            error_log("Record attendance/payment error: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
            exit;
        }
    }




    if ($method === 'GET' && $action === 'get_attendance') {
        $member_id = isset($_GET['member_id']) ? $_GET['member_id'] : '';
        $member_id = (int) $member_id;
        $date = isset($_GET['date']) ? $_GET['date'] : '';
        $month = isset($_GET['month']) ? $_GET['month'] : '';

        $sql = "SELECT ar.*, m.full_name AS member_full_name, 'present' AS status,
                       CASE WHEN ar.payment_status = 'paid' OR EXISTS (
                           SELECT 1
                           FROM payments p
                           WHERE p.attendance_id = ar.id
                             AND LOWER(LTRIM(RTRIM(CAST(p.payment_status AS VARCHAR(50))))) = 'paid'
                       ) THEN 'paid' ELSE 'pending' END AS payment_status
                FROM attendance_records ar
                LEFT JOIN members m ON ar.member_id = m.memberID";
        $params = [];

        if (!empty($member_id)) {
            $sql .= " WHERE ar.member_id = ?";
            $params[] = $member_id;
        }

        if (!empty($date)) {
            $sql .= empty($params) ? " WHERE" : " AND";
            $sql .= " CONVERT(date, ar.attendance_date) = ?";
            $params[] = $date;
        }

        if (!empty($month)) {
            $sql .= empty($params) ? " WHERE" : " AND";
            $sql .= " CONVERT(VARCHAR(7), ar.attendance_date, 126) = ?";
            $params[] = $month;
        }

        $sql .= " ORDER BY ar.attendance_date DESC";
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $promoSql = "SELECT pa.id, pa.availed_at, pa.expiration_date, p.promo_name, p.duration_days
                     FROM promo_availments pa
                     INNER JOIN promotions p ON p.id = pa.promo_id
                 WHERE pa.member_id = ? AND pa.status = 'active' AND pa.availed_at IS NOT NULL AND pa.expiration_date IS NOT NULL";
        $promoParams = [$member_id];
        $promoSql .= " ORDER BY pa.availed_at DESC";
        $promoStmt = $conn->prepare($promoSql);
        $promoStmt->execute($promoParams);
        $promoAvailments = $promoStmt->fetchAll(PDO::FETCH_ASSOC);

        $promoPaymentStmt = $conn->prepare(
            "SELECT payment_id, amount, payment_date, payment_status, notes
             FROM dbo.payments
             WHERE member_id = ? AND payment_type = 'PROMOTION' AND payment_status = 'paid'
             ORDER BY payment_date DESC"
        );
        $promoPaymentStmt->execute([$member_id]);
        $promoPayments = $promoPaymentStmt->fetchAll(PDO::FETCH_ASSOC);

                $paidSessionStmt = $conn->prepare(
                        "SELECT p.payment_id, p.session_id, p.amount, p.payment_date, p.attendance_id,
                                        ts.session_type, ts.start_time, ts.end_time
                         FROM dbo.payments p
                         INNER JOIN dbo.trainer_sessions ts ON ts.id = p.session_id
                         WHERE p.member_id = ?
                             AND p.payment_type = 'TRAINER_SESSION'
                             AND LOWER(LTRIM(RTRIM(CAST(p.payment_status AS VARCHAR(50))))) = 'paid'
                         ORDER BY ts.start_time DESC, p.payment_id DESC"
                );
                $paidSessionStmt->execute([$member_id]);
                $paidSessionPayments = $paidSessionStmt->fetchAll(PDO::FETCH_ASSOC);

                echo json_encode([
                        'success' => true,
                        'records' => $records,
                        'promo_availments' => $promoAvailments,
                        'promo_payments' => $promoPayments,
                        'paid_session_payments' => $paidSessionPayments,
                ]);
        exit;
    }




    if ($method === 'GET' && $action === 'get_pending_members') {
        try {
            $sql = "SELECT memberID, full_name, email, phone, weight, height, age, gender, payment_method, created_at, profile_photo 
                FROM members 
                WHERE status = 'pending'
                ORDER BY created_at ASC";
            $stmt = $conn->query($sql);
            $members = array_map('normalizeMemberRecord', $stmt->fetchAll(PDO::FETCH_ASSOC));

            echo json_encode([
                'success' => true,
                'members' => $members
            ]);
        } catch (PDOException $e) {
            error_log("Get pending members error: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
        exit;
    }




    if ($method === 'POST' && $action === 'approve_member') {
        $member_id = $input['member_id'] ?? '';

        if (empty($member_id)) {
            echo json_encode(['success' => false, 'message' => 'Member ID is required']);
            exit;
        }

        try {
            $nameStmt = $conn->prepare('SELECT full_name FROM members WHERE memberID = ?');
            $nameStmt->execute([$member_id]);
            $memberName = (string) $nameStmt->fetchColumn();
            $sql = "UPDATE members SET status = 'active', approval_status = 'approved' WHERE memberID = ? AND status = 'pending'";
            $stmt = $conn->prepare($sql);
            $stmt->execute([$member_id]);

            if ($stmt->rowCount() > 0) {
                auditAdminActionDetail($conn, $authUser, $action, "Approved member {$memberName}");
                echo json_encode([
                    'success' => true,
                    'message' => 'Member approved successfully!'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Member not found or already processed'
                ]);
            }
        } catch (PDOException $e) {
            error_log("Approve member error: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
        exit;
    }




    if ($method === 'POST' && $action === 'reject_member') {
        $member_id = $input['member_id'] ?? '';
        $rejection_reason = $input['rejection_reason'] ?? '';

        if (empty($member_id)) {
            echo json_encode(['success' => false, 'message' => 'Member ID is required']);
            exit;
        }

        try {
            $nameStmt = $conn->prepare('SELECT full_name FROM members WHERE memberID = ?');
            $nameStmt->execute([$member_id]);
            $memberName = (string) $nameStmt->fetchColumn();
            $sql = "UPDATE members SET status = 'rejected', approval_status = 'rejected', admin_notes = ? WHERE memberID = ? AND status = 'pending'";
            $stmt = $conn->prepare($sql);
            $stmt->execute([$rejection_reason, $member_id]);

            if ($stmt->rowCount() > 0) {
                $detail = "Rejected member {$memberName}";
                if (trim((string) $rejection_reason) !== '') $detail .= ": {$rejection_reason}";
                auditAdminActionDetail($conn, $authUser, $action, $detail);
                echo json_encode([
                    'success' => true,
                    'message' => 'Member rejected successfully'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Member not found or already processed'
                ]);
            }
        } catch (PDOException $e) {
            error_log("Reject member error: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
        exit;
    }





    if ($method === 'GET' && $action === 'get_payments') {
        processOverduePayments($conn, 7);
        $status = strtolower(trim($_GET['status'] ?? 'all'));
        $allowedStatuses = ['all', 'pending', 'paid', 'billed', 'rejected', 'voided', 'refunded'];
        if (!in_array($status, $allowedStatuses, true)) {
            echo json_encode(['success' => false, 'message' => 'Invalid payment status']);
            exit;
        }

        $where = '';
        $params = [];
        if ($status !== 'all') {
            $where = 'WHERE p.payment_status = ?';
            $params[] = $status;
        }

        $sql = "SELECT
                    p.payment_id,
                    p.member_id,
                    p.walk_in_id,
                    COALESCE(m.full_name, w.client_name) AS full_name,
                    w.client_name AS walk_in_name,
                    w.email AS walk_in_email,
                    p.payment_type,
                    p.attendance_id,
                    p.session_id,
                    ts.session_type,
                    ts.start_time AS session_start,
                    p.amount,
                    p.payment_method,
                    p.payment_status,
                    p.payment_date,
                    p.created_at,
                    p.confirmed_at,
                    p.confirmed_by,
                    p.rejection_reason,
                    a.full_name AS confirmed_by_name
                FROM payments p
                LEFT JOIN members m ON m.memberID = p.member_id
                LEFT JOIN walk_in_records w ON w.id = p.walk_in_id
                LEFT JOIN trainer_sessions ts ON ts.id = p.session_id
                LEFT JOIN admin_staff a ON a.adminID = p.confirmed_by
                $where
                ORDER BY CASE WHEN p.payment_status = 'pending' THEN 0 ELSE 1 END,
                         p.payment_date DESC, p.payment_id DESC";
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Always return payment summary totals independently of the selected tab.
        // This lets the Payments UI show the paid amount even while viewing Pending.
        $statsStmt = $conn->query("
            SELECT
                SUM(CASE WHEN LOWER(LTRIM(RTRIM(CAST(payment_status AS VARCHAR(50))))) = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                COALESCE(SUM(CASE WHEN LOWER(LTRIM(RTRIM(CAST(payment_status AS VARCHAR(50))))) = 'pending' THEN amount ELSE 0 END), 0) AS pending_amount,
                SUM(CASE WHEN LOWER(LTRIM(RTRIM(CAST(payment_status AS VARCHAR(50))))) = 'paid' THEN 1 ELSE 0 END) AS paid_count,
                COALESCE(SUM(CASE WHEN LOWER(LTRIM(RTRIM(CAST(payment_status AS VARCHAR(50))))) = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
                SUM(CASE WHEN LOWER(LTRIM(RTRIM(CAST(payment_status AS VARCHAR(50))))) = 'billed' THEN 1 ELSE 0 END) AS billed_count,
                COALESCE(SUM(CASE WHEN LOWER(LTRIM(RTRIM(CAST(payment_status AS VARCHAR(50))))) = 'billed' THEN amount ELSE 0 END), 0) AS billed_amount,
                COUNT(*) AS total_count
            FROM dbo.payments
        ");
        $paymentStats = $statsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        echo json_encode([
            'success' => true,
            'payments' => $payments,
            'stats' => [
                'pending_count' => (int) ($paymentStats['pending_count'] ?? 0),
                'pending_amount' => (float) ($paymentStats['pending_amount'] ?? 0),
                'paid_count' => (int) ($paymentStats['paid_count'] ?? 0),
                'paid_amount' => (float) ($paymentStats['paid_amount'] ?? 0),
                'billed_count' => (int) ($paymentStats['billed_count'] ?? 0),
                'billed_amount' => (float) ($paymentStats['billed_amount'] ?? 0),
                'total_count' => (int) ($paymentStats['total_count'] ?? 0),
            ],
        ]);
        exit;
    }

    if ($method === 'POST' && ($action === 'confirm_payment' || $action === 'bill_payment')) {
        $payment_id = (int) ($input['payment_id'] ?? 0);
        $admin_id = (int) ($authUser['sub'] ?? 0);
        $reason = trim($input['reason'] ?? '');

        if ($payment_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'Payment ID is required']);
            exit;
        }

        if ($admin_id <= 0) {
            echo json_encode([
                'success' => false,
                'message' => 'Valid admin ID is required. Please log out and log in again.'
            ]);
            exit;
        }

        try {
            $conn->beginTransaction();

            $paymentStmt = $conn->prepare(
                "SELECT TOP 1 payment_id, member_id, walk_in_id, payment_type, attendance_id, session_id, amount, payment_status, payment_date
                 FROM payments WITH (UPDLOCK, ROWLOCK)
                 WHERE payment_id = ?"
            );
            $paymentStmt->execute([$payment_id]);
            $payment = $paymentStmt->fetch(PDO::FETCH_ASSOC);
            $paymentStmt->closeCursor();

            if (!$payment) {
                throw new Exception('Payment not found.');
            }

            if (strtolower((string) $payment['payment_status']) !== 'pending') {
                throw new Exception('This payment has already been processed.');
            }

            if ($action === 'bill_payment') {
                $note = $reason !== ''
                    ? $reason
                    : 'Moved to Billing by admin/staff because payment was not confirmed.';
                $attendanceId = $payment['attendance_id'] !== null ? (int) $payment['attendance_id'] : null;
                $billId = getOrCreatePendingBill(
                    $conn,
                    $payment['member_id'] !== null ? (int) $payment['member_id'] : null,
                    $payment['walk_in_id'] !== null ? (int) $payment['walk_in_id'] : null,
                    (int) ($authUser['sub'] ?? 0),
                    $note,
                );
                addBillingAttendanceAmount($conn, $billId, $attendanceId, (float) $payment['amount']);

                $stmt = $conn->prepare("
                    UPDATE payments
                    SET payment_status='billed',
                        confirmed_at=NULL,
                        confirmed_by=NULL,
                        rejection_reason=NULL
                    WHERE payment_id=? AND payment_status='pending'
                ");
                $stmt->execute([$payment_id]);

                $verify = $conn->prepare("SELECT payment_status FROM payments WHERE payment_id=?");
                $verify->execute([$payment_id]);
                if (strtolower((string) $verify->fetchColumn()) !== 'billed') {
                    throw new Exception('Payment was already processed or could not be moved to Billing.');
                }

                $conn->commit();
                echo json_encode([
                    'success' => true,
                    'bill_id' => $billId,
                    'message' => 'Payment added to the member invoice.'
                ]);
                $memberNameStmt = $conn->prepare('SELECT COALESCE(m.full_name, w.client_name) FROM payments p LEFT JOIN members m ON m.memberID = p.member_id LEFT JOIN walk_in_records w ON w.id = p.walk_in_id WHERE p.payment_id = ?');
                $memberNameStmt->execute([$payment_id]);
                auditAdminActionDetail($conn, $authUser, $action, 'moved payment to Billing for ' . (string)$memberNameStmt->fetchColumn());
                exit;
            }

            if ($payment['payment_type'] === 'PROMOTION') {
                $promoAvailabilityStmt = $conn->prepare(
                    "SELECT TOP 1 p.promo_name
                     FROM dbo.promo_availments pa WITH (UPDLOCK, ROWLOCK)
                     INNER JOIN dbo.promotions p ON p.id = pa.promo_id
                     WHERE pa.payment_id = ?
                       AND pa.member_id = ?
                       AND p.is_active = 1
                       AND CAST(GETDATE() AS DATE) <= p.availment_deadline"
                );
                $promoAvailabilityStmt->execute([$payment_id, (int) $payment['member_id']]);
                $promoName = $promoAvailabilityStmt->fetchColumn();
                $promoAvailabilityStmt->closeCursor();

                if (!$promoName) {
                    throw new Exception('This promotion has ended and can no longer be activated. The payment remains pending.');
                }
            }

            // Confirmed payments become revenue and are synchronized to attendance/session records.
            $stmt = $conn->prepare(
                "UPDATE payments
                 SET payment_status='paid', confirmed_at=GETDATE(), confirmed_by=?, rejection_reason=NULL
                 WHERE payment_id=? AND payment_status='pending'"
            );
            $stmt->execute([$admin_id, $payment_id]);

            $verify = $conn->prepare("SELECT payment_status FROM payments WHERE payment_id=?");
            $verify->execute([$payment_id]);
            if (strtolower((string) $verify->fetchColumn()) !== 'paid') {
                throw new Exception('Payment was already processed or no longer exists.');
            }

            if (empty($payment['walk_in_id'])) {
                $syncAttendance = $conn->prepare(
                    "UPDATE attendance_records SET payment_status='paid' WHERE id=?"
                );
                $syncAttendance->execute([(int) ($payment['attendance_id'] ?? 0)]);
            }

            if (!empty($payment['walk_in_id'])) {
                $walkInId = (int) $payment['walk_in_id'];

                $walkInStmt = $conn->prepare(
                    "SELECT TOP 1 id, client_name, emergency_contact, session_type, amount, payment_method
                     FROM walk_in_records WITH (UPDLOCK, ROWLOCK)
                     WHERE id = ?"
                );
                $walkInStmt->execute([$walkInId]);
                $walkIn = $walkInStmt->fetch(PDO::FETCH_ASSOC);

                if (!$walkIn) {
                    throw new Exception('Walk-in record not found.');
                }

                $attendanceId = (int) ($payment['attendance_id'] ?? 0);
                if ($attendanceId > 0) {
                    $attendanceStmt = $conn->prepare(
                        "UPDATE attendance_records SET payment_status='paid' WHERE id=? AND walk_in_id=?"
                    );
                    $attendanceStmt->execute([$attendanceId, $walkInId]);
                } else {
                    $attendanceStmt = $conn->prepare(
                        "INSERT INTO attendance_records
                            (member_id, walk_in_id, payment_method, sessions, total_amount, attendance_date, payment_status)
                         OUTPUT INSERTED.id
                         VALUES (NULL, ?, ?, ?, ?, GETDATE(), 'paid')"
                    );
                    $attendanceStmt->execute([$walkInId, $walkIn['payment_method'], $walkIn['session_type'], $walkIn['amount']]);
                    $attendanceId = (int) $attendanceStmt->fetchColumn();
                }

                $updatePayment = $conn->prepare(
                    "UPDATE payments
                     SET attendance_id=?, payment_status='paid', confirmed_at=GETDATE(), confirmed_by=?, rejection_reason=NULL
                     WHERE payment_id=?"
                );
                $updatePayment->execute([$attendanceId, $admin_id, $payment_id]);

                $updateWalkIn = $conn->prepare(
                    "UPDATE walk_in_records
                     SET payment_status='paid', attendance_id=?, confirmed_at=GETDATE(), confirmed_by=?, rejection_reason=NULL
                     WHERE id=?"
                );
                $updateWalkIn->execute([$attendanceId, $admin_id, $walkInId]);
            }

            if ($payment['payment_type'] === 'TRAINER_SESSION' && !empty($payment['session_id'])) {
                $sessionId = (int) $payment['session_id'];
                $memberId = (int) $payment['member_id'];

                $stmt = $conn->prepare(
                    "UPDATE trainer_sessions
                     SET is_paid = 1, is_booked = 1
                     WHERE id = ?"
                );
                $stmt->execute([$sessionId]);

                $stmt = $conn->prepare(
                    "UPDATE member_session_enrollments
                     SET status = 'paid'
                     WHERE member_id=? AND session_id=?"
                );
                $stmt->execute([$memberId, $sessionId]);
            }

            if ($payment['payment_type'] === 'PROMOTION') {
                $promoStmt = $conn->prepare(
                    "UPDATE pa
                     SET pa.status='active', pa.availed_at=GETDATE(),
                         pa.expiration_date=DATEADD(DAY, p.duration_days, CAST(GETDATE() AS DATE))
                     FROM dbo.promo_availments pa
                     INNER JOIN dbo.promotions p ON p.id=pa.promo_id
                     WHERE pa.payment_id=? AND pa.member_id=?"
                );
                $promoStmt->execute([$payment_id, (int) $payment['member_id']]);
            }

            $conn->commit();
            echo json_encode([
                'success' => true,
                'message' => 'Payment confirmed successfully.'
            ]);
            $memberNameStmt = $conn->prepare('SELECT COALESCE(m.full_name, w.client_name) FROM payments p LEFT JOIN members m ON m.memberID = p.member_id LEFT JOIN walk_in_records w ON w.id = p.walk_in_id WHERE p.payment_id = ?');
            $memberNameStmt->execute([$payment_id]);
            auditAdminActionDetail($conn, $authUser, $action, 'confirmed payment for ' . (string)$memberNameStmt->fetchColumn());
            exit;
        } catch (Throwable $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            error_log("Payment processing error: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
            exit;
        }
    }

    if ($method === 'POST' && $action === 'create_walk_in') {
        $clientName = preg_replace('/\s+/u', ' ', trim((string) ($input['client_name'] ?? '')));
        $clientName = trim(preg_replace('/[\x00-\x1F\x7F]/', ' ', $clientName));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $email = preg_replace('/[\x00-\x1F\x7F\s]/', '', $email);
        $paymentMethod = trim($input['payment_method'] ?? 'Cash');
        $createdBy = (int) ($authUser['sub'] ?? 0);

        if ($clientName === '') {
            echo json_encode(['success' => false, 'message' => 'Client name is required.']);
            exit;
        }
        if (strlen($clientName) > 150 || !preg_match("/^[\p{L}\p{M}0-9 .,&'\-]+$/u", $clientName)) {
            echo json_encode(['success' => false, 'message' => 'Client name contains invalid characters or is too long.']);
            exit;
        }
        if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'A valid client email is required.']);
            exit;
        }
        if (!in_array($paymentMethod, ['Cash', 'GCash'], true))
            $paymentMethod = 'Cash';

        try {
            $walkInPrice = 80.00;
            $sessionType = 'Walk-in Regular Session';

            $conn->beginTransaction();
            $walkInStmt = $conn->prepare("INSERT INTO walk_in_records (client_name, email, session_type, amount, payment_method, payment_status, created_by, created_at) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, 'pending', ?, GETDATE())");
            $walkInStmt->execute([$clientName, $email, $sessionType, $walkInPrice, $paymentMethod, $createdBy ?: null]);
            $walkInId = (int) $walkInStmt->fetchColumn();

            $attendanceStmt = $conn->prepare("INSERT INTO attendance_records (member_id, walk_in_id, payment_method, sessions, total_amount, attendance_date, payment_status) OUTPUT INSERTED.id VALUES (NULL, ?, ?, ?, ?, GETDATE(), 'pending')");
            $attendanceStmt->execute([$walkInId, $paymentMethod, $sessionType, $walkInPrice]);
            $attendanceId = (int) $attendanceStmt->fetchColumn();

            $paymentStmt = $conn->prepare("INSERT INTO payments (member_id, walk_in_id, payment_type, attendance_id, session_id, amount, payment_method, payment_status, payment_date, recorded_by, notes) OUTPUT INSERTED.payment_id VALUES (NULL, ?, 'REGULAR_SESSION', ?, NULL, ?, ?, 'pending', GETDATE(), ?, ?)");
            $paymentStmt->execute([$walkInId, $attendanceId, $walkInPrice, $paymentMethod, $createdBy ?: null, $sessionType]);
            $paymentId = (int) $paymentStmt->fetchColumn();
            $walkInUpdate = $conn->prepare("UPDATE walk_in_records SET payment_id=?, attendance_id=? WHERE id=?");
            $walkInUpdate->execute([$paymentId, $attendanceId, $walkInId]);
            $conn->commit();

            echo json_encode(['success' => true, 'message' => 'Walk-in recorded with payment pending staff confirmation.', 'walk_in_id' => $walkInId, 'payment_id' => $paymentId, 'attendance_id' => $attendanceId, 'amount' => $walkInPrice, 'session_type' => $sessionType]);
            auditAdminActionDetail($conn, $authUser, $action, "Recorded walk-in for {$clientName}; payment is pending staff confirmation");
        } catch (Exception $e) {
            if ($conn->inTransaction())
                $conn->rollBack();
            auditSystemError($conn, 'Walk-in payment creation', $e);
            error_log('Create walk-in error: ' . $e->getMessage());
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($method === 'GET' && $action === 'get_walk_ins') {
        $month = isset($_GET['month']) ? (int) $_GET['month'] : 0;
        $year = isset($_GET['year']) ? (int) $_GET['year'] : 0;
        try {
            $sql = "SELECT w.*, p.payment_status AS linked_payment_status, p.payment_id AS linked_payment_id, p.confirmed_at AS payment_confirmed_at, a.attendance_date AS check_in_date FROM walk_in_records w LEFT JOIN payments p ON p.walk_in_id=w.id LEFT JOIN attendance_records a ON a.walk_in_id=w.id";
            $params = [];
            if ($month >= 1 && $month <= 12 && $year >= 2000 && $year <= 2100) {
                $start = sprintf('%04d-%02d-01', $year, $month);
                $end = date('Y-m-d', strtotime($start . ' +1 month'));
                $sql .= " WHERE w.created_at >= ? AND w.created_at < ?";
                $params = [$start, $end];
            }
            $sql .= " ORDER BY w.created_at DESC, w.id DESC";
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
            echo json_encode(['success' => true, 'records' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($method === 'GET' && $action === 'get_revenue') {
        $month = isset($_GET['month']) ? (int) $_GET['month'] : (int) date('n');
        $year = isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y');
        $hasDateRange = isset($_GET['start_date']) || isset($_GET['end_date']);
        $rangeStart = null;
        $rangeEnd = null;

        if ($month < 1 || $month > 12 || $year < 2000 || $year > 2100) {
            echo json_encode(['success' => false, 'message' => 'Invalid month or year']);
            exit;
        }

        if ($hasDateRange) {
            $startInput = (string) ($_GET['start_date'] ?? '');
            $endInput = (string) ($_GET['end_date'] ?? '');
            $rangeStart = DateTimeImmutable::createFromFormat('!Y-m-d', $startInput);
            $startErrors = DateTimeImmutable::getLastErrors();
            $rangeEnd = DateTimeImmutable::createFromFormat('!Y-m-d', $endInput);
            $endErrors = DateTimeImmutable::getLastErrors();

            if (
                !$rangeStart || !$rangeEnd ||
                ($startErrors !== false && ($startErrors['warning_count'] || $startErrors['error_count'])) ||
                ($endErrors !== false && ($endErrors['warning_count'] || $endErrors['error_count'])) ||
                $rangeStart->format('Y-m-d') !== $startInput ||
                $rangeEnd->format('Y-m-d') !== $endInput ||
                $rangeStart > $rangeEnd
            ) {
                echo json_encode(['success' => false, 'message' => 'Invalid date range']);
                exit;
            }
        }

        try {

            $startDate = sprintf('%04d-%02d-01', $year, $month);
            $endDate = date('Y-m-d', strtotime($startDate . ' +1 month'));
            if ($hasDateRange) {
                $startDate = $rangeStart->format('Y-m-d');
                $endDate = $rangeEnd->modify('+1 day')->format('Y-m-d');
            }

            $dateExpression = $hasDateRange
                ? 'CONVERT(date, COALESCE(ar.attendance_date, p.payment_date))'
                : 'DAY(COALESCE(ar.attendance_date, p.payment_date))';
            $dailySql = "SELECT
                            {$dateExpression} AS date,
                            SUM(p.amount) AS amount,
                            COUNT(*) AS transactions
                         FROM payments p
                         LEFT JOIN attendance_records ar ON ar.id = p.attendance_id
                         WHERE p.payment_status = 'paid'
                           AND COALESCE(ar.attendance_date, p.payment_date) >= ?
                           AND COALESCE(ar.attendance_date, p.payment_date) < ?
                         GROUP BY {$dateExpression}
                         ORDER BY date ASC";
            $dailyStmt = $conn->prepare($dailySql);
            $dailyStmt->execute([$startDate, $endDate]);
            $dailyRows = $dailyStmt->fetchAll(PDO::FETCH_ASSOC);

            $revenueByDay = [];
            if ($hasDateRange) {
                for ($date = $rangeStart; $date <= $rangeEnd; $date = $date->modify('+1 day')) {
                    $revenueByDay[$date->format('Y-m-d')] = ['amount' => 0.0, 'transactions' => 0];
                }
            } else {
                $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
                for ($day = 1; $day <= $daysInMonth; $day++) {
                    $revenueByDay[$day] = ['amount' => 0.0, 'transactions' => 0];
                }
            }
            foreach ($dailyRows as $row) {
                $dateKey = $hasDateRange ? (string) $row['date'] : (int) $row['date'];
                if (!array_key_exists($dateKey, $revenueByDay)) {
                    continue;
                }
                $revenueByDay[$dateKey] = [
                    'amount' => (float) $row['amount'],
                    'transactions' => (int) $row['transactions'],
                ];
            }

            $revenue = [];
            foreach ($revenueByDay as $date => $data) {
                $revenue[] = [
                    'date' => $date,
                    'day' => $date,
                    'amount' => $data['amount'],
                    'transactions' => $data['transactions'],
                ];
            }

                        $totalSql = "SELECT
                                                        COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS total_amount,
                            COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 END) AS total_transactions
                                                 FROM payments p
                                                 LEFT JOIN attendance_records ar ON ar.id = p.attendance_id
                                                 WHERE p.payment_status = 'paid'
                                                     AND COALESCE(ar.attendance_date, p.payment_date) >= ?
                                                     AND COALESCE(ar.attendance_date, p.payment_date) < ?";
            $totalStmt = $conn->prepare($totalSql);
            $totalStmt->execute([$startDate, $endDate]);
            $total = $totalStmt->fetch(PDO::FETCH_ASSOC);

                        $breakdownSql = "SELECT
                                                                p.payment_type,
                                                                COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS amount,
                                COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 END) AS transactions
                                                         FROM payments p
                                                         LEFT JOIN attendance_records ar ON ar.id = p.attendance_id
                                                         WHERE p.payment_status = 'paid'
                                                             AND COALESCE(ar.attendance_date, p.payment_date) >= ?
                                                             AND COALESCE(ar.attendance_date, p.payment_date) < ?
                                                         GROUP BY p.payment_type
                                                         ORDER BY p.payment_type";
            $breakdownStmt = $conn->prepare($breakdownSql);
            $breakdownStmt->execute([$startDate, $endDate]);
            $breakdown = $breakdownStmt->fetchAll(PDO::FETCH_ASSOC);

                        $methodSql = "SELECT
                                                            p.payment_method,
                                                            COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS amount,
                              COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 END) AS transactions
                                                    FROM payments p
                                                    LEFT JOIN attendance_records ar ON ar.id = p.attendance_id
                                                    WHERE p.payment_status = 'paid'
                                                        AND COALESCE(ar.attendance_date, p.payment_date) >= ?
                                                        AND COALESCE(ar.attendance_date, p.payment_date) < ?
                                                    GROUP BY p.payment_method
                                                    ORDER BY p.payment_method";
            $methodStmt = $conn->prepare($methodSql);
            $methodStmt->execute([$startDate, $endDate]);
            $paymentMethods = $methodStmt->fetchAll(PDO::FETCH_ASSOC);

            $detailsSql = "SELECT
                              p.payment_id,
                              p.member_id,
                              m.full_name AS member_name,
                              p.payment_type,
                              p.amount,
                              p.payment_method,
                              p.payment_status,
                              p.payment_date,
                              COALESCE(ar.attendance_date, p.payment_date) AS report_date,
                              p.attendance_id,
                              p.session_id,
                              ts.session_type,
                              t.full_name AS trainer_name
                           FROM payments p
                           LEFT JOIN attendance_records ar ON ar.id = p.attendance_id
                           LEFT JOIN members m ON p.member_id = m.memberID
                           LEFT JOIN trainer_sessions ts ON p.session_id = ts.id
                           LEFT JOIN trainers t ON ts.trainer_id = t.trainerID
                                                     WHERE COALESCE(ar.attendance_date, p.payment_date) >= ?
                                                         AND COALESCE(ar.attendance_date, p.payment_date) < ?
                                                     ORDER BY report_date DESC";
            $detailsStmt = $conn->prepare($detailsSql);
            $detailsStmt->execute([$startDate, $endDate]);
            $details = $detailsStmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'revenue' => $revenue,
                'total' => [
                    'amount' => (float) ($total['total_amount'] ?? 0),
                    'transactions' => (int) ($total['total_transactions'] ?? 0),
                ],
                'breakdown' => $breakdown,
                'payment_methods' => $paymentMethods,
                'details' => $details,
                'month' => $month,
                'year' => $year,
            ]);
        } catch (PDOException $e) {
            error_log("Get revenue error: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
        exit;
    }




    if ($method === 'GET' && $action === 'get_all_sessions') {
        try {
            $sql = "SELECT ts.*, t.full_name as trainer_name
                FROM trainer_sessions ts
                LEFT JOIN trainers t ON ts.trainer_id = t.trainerID
                ORDER BY ts.created_at DESC";
            $stmt = $conn->query($sql);
            $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'sessions' => $sessions
            ]);
        } catch (PDOException $e) {
            error_log("Get all sessions error: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
        exit;
    }


} catch (PDOException $e) {
    if (isset($conn) && $conn instanceof PDO) {
        auditSystemError($conn, 'Member API', $e);
    }
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}