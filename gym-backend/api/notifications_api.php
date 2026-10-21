<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
require_once __DIR__.'/config/auth.php';
require_once __DIR__.'/config/db.php';
require_once __DIR__.'/config/audit.php';
$authUser=requireValidToken();
$isAdmin=in_array(strtolower((string)($authUser['role']??'')),['admin','staff'],true);
$authRole=strtolower((string)($authUser['role']??''));
$authRecipient=(int)($authUser['sub']??0);

function respond($success, $message = '', $extra = [], $status = 200) {
    http_response_code($status);
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message,
    ], $extra));
    exit;
}

function getConnection() {
    try {
        $conn = new PDO(
            "odbc:Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=GymDB;Trusted_Connection=yes;TrustServerCertificate=yes;"
        );
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $conn;
    } catch (PDOException $e) {
        respond(false, 'Database connection failed.', [], 500);
    }
}

function ensureNotificationColumns(PDO $conn): void {
    if (!$conn->query("SELECT COL_LENGTH('dbo.notifications', 'recipient_id')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.notifications ADD recipient_id INT NULL");
    }
    if (!$conn->query("SELECT COL_LENGTH('dbo.notifications', 'role')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.notifications ADD role NVARCHAR(50) NULL");
    }
    if (!$conn->query("SELECT COL_LENGTH('dbo.notifications', 'is_read')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.notifications ADD is_read BIT NOT NULL DEFAULT 0");
    }
    if (!$conn->query("SELECT COL_LENGTH('dbo.notifications', 'created_at')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.notifications ADD created_at DATETIME NOT NULL DEFAULT GETDATE()");
    }
}

function processSessionReminders(PDO $conn): void {
    try {
        $conn->exec("IF OBJECT_ID(N'dbo.session_reminder_log', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.session_reminder_log (
                id INT IDENTITY(1,1) PRIMARY KEY,
                session_id INT NOT NULL,
                recipient_role VARCHAR(20) NOT NULL,
                recipient_id INT NOT NULL,
                sent_at DATETIME NOT NULL DEFAULT GETDATE(),
                CONSTRAINT UQ_session_reminder_recipient UNIQUE (session_id, recipient_role, recipient_id)
            );
        END");

        $stmt = $conn->query(
            "SELECT ts.id, ts.session_type, ts.start_time,
                    t.trainerID, t.full_name AS trainer_name, t.email AS trainer_email,
                    m.memberID, m.full_name AS member_name, m.email AS member_email
             FROM dbo.trainer_sessions ts
             INNER JOIN dbo.trainers t ON t.trainerID = ts.trainer_id
             INNER JOIN dbo.member_session_enrollments mse ON mse.session_id = ts.id
             INNER JOIN dbo.members m ON m.memberID = mse.member_id
             WHERE ts.status = 'approved'
               AND mse.status IN ('pending', 'paid')
               AND ts.start_time > DATEADD(MINUTE, 55, GETDATE())
               AND ts.start_time <= DATEADD(MINUTE, 65, GETDATE())"
        );
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!$sessions) {
            return;
        }

        require_once __DIR__ . '/config/email_config.php';
        $logStmt = $conn->prepare(
            "INSERT INTO dbo.session_reminder_log (session_id, recipient_role, recipient_id, sent_at)
             SELECT ?, ?, ?, GETDATE()
             WHERE NOT EXISTS (
                 SELECT 1 FROM dbo.session_reminder_log
                 WHERE session_id = ? AND recipient_role = ? AND recipient_id = ?
             )"
        );
        $notificationStmt = $conn->prepare(
            "INSERT INTO notifications (title, message, type, role, recipient_id, is_read, created_at)
             VALUES (?, ?, 'info', ?, ?, 0, GETDATE())"
        );

        foreach ($sessions as $session) {
            $start = date('F j, Y g:i A', strtotime((string) $session['start_time']));
            $sessionName = trim((string) ($session['session_type'] ?? 'Training session'));
            $recipients = [
                [
                    'role' => 'trainer',
                    'id' => (int) $session['trainerID'],
                    'name' => (string) $session['trainer_name'],
                    'email' => (string) ($session['trainer_email'] ?? ''),
                    'message' => "Your {$sessionName} session starts in about 1 hour ({$start}).",
                ],
                [
                    'role' => 'member',
                    'id' => (int) $session['memberID'],
                    'name' => (string) $session['member_name'],
                    'email' => (string) ($session['member_email'] ?? ''),
                    'message' => "Your {$sessionName} session with trainer {$session['trainer_name']} starts in about 1 hour ({$start}).",
                ],
            ];

            foreach ($recipients as $recipient) {
                $logStmt->execute([
                    (int) $session['id'],
                    $recipient['role'],
                    $recipient['id'],
                    (int) $session['id'],
                    $recipient['role'],
                    $recipient['id'],
                ]);
                if ($logStmt->rowCount() === 0) {
                    continue;
                }

                $notificationStmt->execute([
                    'Session Reminder',
                    $recipient['message'],
                    $recipient['role'],
                    $recipient['id'],
                ]);

                if ($recipient['email'] !== '') {
                    smtpSendPlainText(
                        $recipient['email'],
                        'Capra Fitness Session Reminder',
                        "Hello {$recipient['name']},\r\n\r\n{$recipient['message']}\r\n\r\nCapra Fitness"
                    );
                }
            }
        }
    } catch (Throwable $e) {
        auditSystemError($conn, 'Notification session reminder processing', $e);
        error_log('Session reminder processing failed: ' . $e->getMessage());
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = [];
}

try {
    $conn = getConnection();
    ensureNotificationColumns($conn);
    if ($action !== 'add') {
        auditAdminAction($conn, $authUser, $action);
    }
    processSessionReminders($conn);

    if ($method === 'GET' && ($action === 'get' || $action === '')) {
        $role = $isAdmin ? ($_GET['role'] ?? 'admin') : $authRole;
        $recipientId = $isAdmin ? ($_GET['recipient_id'] ?? null) : $authRecipient;

        $sql = "SELECT id, title, message, type, role, recipient_id, is_read, created_at
                FROM notifications
                WHERE role = ?";
        $params = [$role];

        if ($recipientId !== null && $recipientId !== '') {
            $sql .= " AND (recipient_id = ? OR recipient_id IS NULL)";
            $params[] = $recipientId;
        }

        $sql .= " ORDER BY created_at DESC";
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $formatted = [];
        foreach ($notifications as $notif) {
            $formatted[] = [
                'id' => (int)$notif['id'],
                'title' => $notif['title'] ?? 'Notification',
                'message' => $notif['message'] ?? '',
                'type' => $notif['type'] ?? 'info',
                'read' => (bool)$notif['is_read'],
                'created_at' => $notif['created_at'],
            ];
        }

        respond(true, '', ['notifications' => $formatted]);
    }

    if ($method === 'POST' && $action === 'add') {
        $title = trim((string)($input['title'] ?? 'Notification'));
        $message = trim((string)($input['message'] ?? ''));
        $type = trim((string)($input['type'] ?? 'info'));
        if (!$isAdmin) { respond(false, 'Only admins can create arbitrary notifications.', [], 403); }
        $role = trim((string)($input['role'] ?? 'admin'));
        $recipientId = $input['recipient_id'] ?? null;

        if ($message === '') {
            respond(false, 'Message is required', [], 400);
        }

        $sql = "INSERT INTO notifications
                (title, message, type, role, recipient_id, is_read, created_at)
                VALUES (?, ?, ?, ?, ?, 0, GETDATE())";
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            $title,
            $message,
            $type,
            $role,
            ($recipientId === '' ? null : $recipientId),
        ]);

        respond(true, 'Notification added successfully');
    }

    if ($method === 'PUT' && $action === 'mark_read') {
        $notificationId = (int)($input['id'] ?? 0);
        if ($notificationId <= 0) {
            respond(false, 'Notification ID is required', [], 400);
        }

        $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE id = ?");
        $stmt->execute([$notificationId]);
        respond(true, 'Notification marked as read');
    }

    if ($method === 'PUT' && $action === 'mark_all_read') {
        $role = $isAdmin ? ($input['role'] ?? 'admin') : $authRole;
        $recipientId = $isAdmin ? ($input['recipient_id'] ?? null) : $authRecipient;

        if ($recipientId !== null && $recipientId !== '') {
            $stmt = $conn->prepare(
                "UPDATE notifications SET is_read = 1
                 WHERE role = ? AND (recipient_id = ? OR recipient_id IS NULL)"
            );
            $stmt->execute([$role, $recipientId]);
        } else {
            $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE role = ?");
            $stmt->execute([$role]);
        }

        respond(true, 'All notifications marked as read');
    }

    if ($method === 'DELETE' && $action === 'delete') {
        $notificationId = (int)($_GET['id'] ?? 0);
        if (!$isAdmin) {
            $owner = $conn->prepare("SELECT 1 FROM notifications WHERE id=? AND role=? AND (recipient_id=? OR recipient_id IS NULL)");
            $owner->execute([$notificationId,$authRole,$authRecipient]);
            if (!$owner->fetchColumn()) respond(false, 'Notification not found.', [], 404);
        }
        if ($notificationId <= 0) {
            respond(false, 'Notification ID is required', [], 400);
        }

        $titleStmt = $conn->prepare('SELECT title FROM notifications WHERE id = ?');
        $titleStmt->execute([$notificationId]);
        $notificationTitle = (string) $titleStmt->fetchColumn();
        $stmt = $conn->prepare("DELETE FROM notifications WHERE id = ?");
        $stmt->execute([$notificationId]);
        if ($isAdmin) auditAdminActionDetail($conn, $authUser, $action, "deleted notification '{$notificationTitle}'");
        respond(true, 'Notification deleted successfully');
    }

    if ($method === 'DELETE' && $action === 'clear_all') {
        $role = $isAdmin ? ($_GET['role'] ?? 'admin') : $authRole;
        $recipientId = $isAdmin ? ($_GET['recipient_id'] ?? null) : $authRecipient;

        if ($recipientId !== null && $recipientId !== '') {
            $stmt = $conn->prepare(
                "DELETE FROM notifications
                 WHERE role = ? AND (recipient_id = ? OR recipient_id IS NULL)"
            );
            $stmt->execute([$role, $recipientId]);
        } else {
            $stmt = $conn->prepare("DELETE FROM notifications WHERE role = ?");
            $stmt->execute([$role]);
        }

        respond(true, 'All notifications cleared');
    }

    respond(false, 'Invalid action', [], 400);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof PDO) {
        auditSystemError($conn, 'Notifications API', $e);
    }
    error_log('notifications_api.php: ' . $e->getMessage());
    respond(false, 'Notification service error.', [], 500);
}
