<?php

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');

header('Content-Type: application/json');

header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

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
        error_log("Database connection failed: " . $e->getMessage());
        return null;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];
if ($method === 'POST' && !empty($_POST)) {
    $input = array_merge($input, $_POST);
}
$action = isset($_GET['action']) ? $_GET['action'] : '';
require_once __DIR__ . '/config/auth.php';

$conn = getConnection();






function resolveMemberId(PDO $conn, $candidateId, $email = '')
{
    $candidateId = (int) $candidateId;
    $email = trim((string) $email);

    if ($candidateId > 0) {
        $stmt = $conn->prepare(
            "SELECT memberID, full_name, email FROM members WHERE memberID = ? AND deleted_at IS NULL AND status = 'active'"
        );
        $stmt->execute([$candidateId]);
        $member = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($member) {
            return $member;
        }
    }

    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $stmt = $conn->prepare(
            "SELECT memberID, full_name, email FROM members WHERE email = ? AND deleted_at IS NULL AND status = 'active'"
        );
        $stmt->execute([$email]);
        $member = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($member) {
            return $member;
        }
    }

    return null;
}


function validateAdmin(PDO $conn, $adminId)
{
    $adminId = (int) $adminId;
    if ($adminId <= 0)
        return null;
    $stmt = $conn->prepare("SELECT adminID, full_name, email FROM admin_staff WHERE adminID = ? AND deleted_at IS NULL AND (status IS NULL OR LOWER(status) IN ('active','approved'))");
    $stmt->execute([$adminId]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);
    $stmt->closeCursor();
    return $admin ?: null;
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
            image_url NVARCHAR(500) NULL,
            CONSTRAINT CK_gym_session_types_price CHECK (price >= 0)
        );
    END");

    if (!$conn->query("SELECT COL_LENGTH('dbo.gym_session_types','image_url')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.gym_session_types ADD image_url NVARCHAR(500) NULL");
    }

    $seeds = [
        ['Regular Session', 50],
        ['Weight Lifting', 200],
        ['Boxing', 200],
        ['Personal Trainer', 200],
        ['Pickleball', 200],
        ['Walk-in Regular Session', 80],
    ];
    $stmt = $conn->prepare("IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = ?) INSERT INTO dbo.gym_session_types (session_name, price) VALUES (?, ?)");
    foreach ($seeds as [$name, $price])
        $stmt->execute([$name, $name, $price]);
    $conn->exec("UPDATE dbo.gym_session_types SET price=80, is_active=1, updated_at=GETDATE() WHERE session_name=N'Walk-in Regular Session'");
}

function normalizeMaxParticipants($value): int
{
    if (is_array($value)) {
        return 1;
    }

    $normalized = trim((string) $value);
    if ($normalized === '') {
        return 1;
    }

    if (!preg_match('/^-?\d+$/', $normalized)) {
        return 1;
    }

    $parsed = (int) $normalized;
    return max(1, $parsed);
}

function ensureTrainerSessionColumns(PDO $conn)
{
    $conn->exec("IF COL_LENGTH('dbo.trainer_sessions', 'max_participants') IS NULL
    BEGIN
        ALTER TABLE dbo.trainer_sessions ADD max_participants INT NOT NULL DEFAULT 1;
    END");

    $conn->exec("UPDATE dbo.trainer_sessions SET max_participants = 1 WHERE max_participants IS NULL OR max_participants < 1");
}

function ensureCoachlessTrainerSessions(PDO $conn): void
{
    $conn->exec("IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.trainer_sessions')
          AND name = N'trainer_id'
          AND is_nullable = 0
    )
    BEGIN
        ALTER TABLE dbo.trainer_sessions ALTER COLUMN trainer_id INT NULL;
    END");
}

function ensureMemberSessionRatings(PDO $conn): void
{
    $conn->exec("IF OBJECT_ID(N'dbo.member_session_ratings', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.member_session_ratings (
            id INT IDENTITY(1,1) PRIMARY KEY,
            member_id INT NOT NULL,
            session_id INT NOT NULL,
            rating TINYINT NOT NULL,
            rated_at DATETIME NOT NULL DEFAULT GETDATE(),
            CONSTRAINT CK_member_session_ratings_rating CHECK (rating BETWEEN 1 AND 5),
            CONSTRAINT UQ_member_session_ratings_member_session UNIQUE (member_id, session_id),
            CONSTRAINT FK_member_session_ratings_member FOREIGN KEY (member_id) REFERENCES dbo.members(memberID),
            CONSTRAINT FK_member_session_ratings_session FOREIGN KEY (session_id) REFERENCES dbo.trainer_sessions(id)
        );
    END

    INSERT INTO dbo.member_session_ratings (member_id, session_id, rating)
    SELECT m.memberID, ts.id, CONVERT(TINYINT, ts.rating)
    FROM dbo.trainer_sessions ts
    INNER JOIN dbo.members m
        ON LOWER(LTRIM(RTRIM(m.full_name))) = LOWER(LTRIM(RTRIM(ts.rated_by)))
    WHERE ts.rating BETWEEN 1 AND 5
      AND ts.rated_by IS NOT NULL
      AND (SELECT COUNT(*) FROM dbo.members mx
           WHERE LOWER(LTRIM(RTRIM(mx.full_name))) = LOWER(LTRIM(RTRIM(ts.rated_by)))) = 1
      AND NOT EXISTS (
          SELECT 1 FROM dbo.member_session_ratings existing
          WHERE existing.member_id = m.memberID AND existing.session_id = ts.id
      );");
}

function sendTrainerSessionNotification(PDO $conn, int $trainerId, string $title, string $message, string $type = 'info'): void
{
    if ($trainerId <= 0) {
        return;
    }

    try {
        $stmt = $conn->prepare(
            "INSERT INTO notifications (title, message, type, role, recipient_id, is_read, created_at)
             VALUES (?, ?, ?, 'trainer', ?, 0, GETDATE())"
        );
        $stmt->execute([$title, $message, $type, $trainerId]);
    } catch (Throwable $e) {
        error_log('Trainer session notification failed: ' . $e->getMessage());
    }
}

function finalizePastSessions(PDO $conn): array
{
    $rows = [];

    try {
        $stmt = $conn->prepare(
                        "SELECT id, trainer_id, session_type, start_time, end_time, status
             FROM trainer_sessions
                         WHERE status IN ('approved','ongoing')
                             AND end_time <= GETDATE()"
        );
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $session) {
            $id = (int) ($session['id'] ?? 0);
            $trainerId = (int) ($session['trainer_id'] ?? 0);
            $type = trim((string) ($session['session_type'] ?? 'Session'));
            $start = $session['start_time'] ?? null;

            $update = $conn->prepare(
                "UPDATE trainer_sessions
                 SET status = 'finished', admin_notes = COALESCE(admin_notes, 'Session automatically finished when the scheduled end time was reached.')
                 WHERE id = ? AND status IN ('approved','ongoing')"
            );
            $update->execute([$id]);

            if ($update->rowCount() > 0) {
                sendTrainerSessionNotification(
                    $conn,
                    $trainerId,
                    'Session finished',
                    "Your {$type} session scheduled for " . ($start ? date('M j, Y g:i A', strtotime((string) $start)) : 'the selected time') . " has been marked finished after its scheduled end time.",
                    'info'
                );
            }
        }

        $expiredEnrollmentSql = "
            UPDATE mse
            SET status = 'unpaid'
            FROM member_session_enrollments mse
            INNER JOIN trainer_sessions ts ON ts.id = mse.session_id
            WHERE mse.status = 'pending'
              AND ts.start_time < GETDATE()
        ";

        $conn->exec($expiredEnrollmentSql);
    } catch (Throwable $e) {
        error_log('Auto-finish past sessions failed: ' . $e->getMessage());
    }

    return $rows;
}

if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

if (!$conn->query("SELECT COL_LENGTH('dbo.trainers', 'profile_photo')")->fetchColumn()) {
    $conn->exec("ALTER TABLE dbo.trainers ADD profile_photo NVARCHAR(500) NULL");
}

$adminActions = ['get_session_catalog', 'save_session_type', 'delete_session_type', 'activate_session_type', 'get_promos', 'save_promo', 'end_promo', 'delete_promo', 'admin_create_session', 'admin_create_pickleball_session', 'admin_update_session', 'admin_terminate_session', 'approve_session', 'reject_session', 'get_trainers', 'get_all_sessions', 'get_report_trainers', 'upload_session_type_image'];
$trainerActions = ['get_session_catalog', 'create_trainer_session', 'get_trainer_sessions', 'update_session', 'delete_session', 'start_session', 'finish_session', 'trainer_terminate_session', 'get_session_booked_members', 'get_trainer_profile', 'update_trainer_profile'];
$memberActions = ['get_session_catalog', 'get_available_sessions', 'get_my_sessions', 'get_promos', 'avail_promo', 'book_session', 'terminate_session', 'rate_session'];
$authUser = requireActionRole($action, $adminActions, $trainerActions, $memberActions);
if (in_array(strtolower((string) ($authUser['role'] ?? '')), ['admin', 'staff'], true)) {
    $input['admin_id'] = (int) $authUser['sub'];
}
if (strtolower((string) ($authUser['role'] ?? '')) === 'member') {
    $input['member_id'] = (int) $authUser['sub'];
    $input['member_email'] = (string) ($authUser['email'] ?? '');
    $input['actor_role'] = 'member';
    $requested = (int) ($input['member_id'] ?? $_GET['member_id'] ?? 0);
}
if (in_array($action, ['get_trainer_sessions', 'create_trainer_session', 'update_session', 'delete_session', 'start_session', 'finish_session', 'trainer_terminate_session'], true) && strtolower((string) ($authUser['role'] ?? '')) === 'trainer') {
    $requested = (int) ($input['trainer_id'] ?? $_GET['trainer_id'] ?? $authUser['sub']);
    if ($requested !== (int) $authUser['sub'])
        authError('You can only manage your own trainer sessions.');
}






if ($method === 'POST' && $action === 'upload_session_type_image') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }

    if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
        echo json_encode(['success' => false, 'message' => 'Please select an image to upload.']);
        exit;
    }

    $file = $_FILES['image'];

    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'message' => 'The image upload failed.']);
        exit;
    }

    if (($file['size'] ?? 0) <= 0 || ($file['size'] ?? 0) > 5 * 1024 * 1024) {
        echo json_encode(['success' => false, 'message' => 'Image must be greater than 0 bytes and no larger than 5 MB.']);
        exit;
    }

    $tmp = (string) ($file['tmp_name'] ?? '');
    $mime = '';

    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $mime = (string) finfo_file($finfo, $tmp);
            finfo_close($finfo);
        }
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    if (!isset($allowed[$mime])) {
        echo json_encode(['success' => false, 'message' => 'Only JPG, PNG, WEBP, and GIF images are allowed.']);
        exit;
    }

    try {
        $uploadDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'session_uploads';

        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
            throw new RuntimeException('Unable to create the session image directory.');
        }

        $filename = 'session_' . bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
        $destination = $uploadDir . DIRECTORY_SEPARATOR . $filename;

        if (!move_uploaded_file($tmp, $destination)) {
            throw new RuntimeException('Unable to save the uploaded image.');
        }

        $imageUrl = 'session_uploads/' . $filename;

        echo json_encode([
            'success' => true,
            'message' => 'Session preview uploaded successfully.',
            'image_url' => $imageUrl,
        ]);
    } catch (Throwable $e) {
        error_log('Session image upload error: ' . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Unable to upload session preview.',
        ]);
    }
    exit;
}

if ($method === 'GET' && $action === 'get_session_catalog') {
    try {
        ensureSessionCatalog($conn);
        $stmt = $conn->query("SELECT id, session_name, price, is_active, created_at, updated_at, image_url FROM dbo.gym_session_types ORDER BY id ASC");
        echo json_encode(['success' => true, 'session_types' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (PDOException $e) {
        error_log('Get session catalog error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'GET' && $action === 'get_promos') {
    try {
        $isMember = strtolower((string) ($authUser['role'] ?? '')) === 'member';
        $sql = "SELECT id, promo_name, price, duration_days, availment_deadline, image_url, is_active, created_at, updated_at FROM dbo.promotions";
        if ($isMember) {
            $sql .= " WHERE is_active=1 AND CAST(GETDATE() AS DATE) <= availment_deadline";
        }
        $sql .= " ORDER BY id DESC";
        $stmt = $conn->query($sql);
        echo json_encode(['success' => true, 'promos' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (PDOException $e) {
        error_log('Get promotions error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Unable to load promotions.']);
    }
    exit;
}

if ($method === 'POST' && $action === 'save_promo') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }

    $promoId = (int) ($input['id'] ?? 0);
    $promoName = trim((string) ($input['promo_name'] ?? ''));
    $price = (float) ($input['price'] ?? 0);
    $durationDays = (int) ($input['duration_days'] ?? 0);
    $availmentDeadline = trim((string) ($input['availment_deadline'] ?? ''));
    $imageUrl = trim((string) ($input['image_url'] ?? ''));

    if ($promoName === '' || $durationDays <= 0 || $availmentDeadline === '') {
        echo json_encode(['success' => false, 'message' => 'Promo name, price, duration, and availment deadline are required.']);
        exit;
    }
    if ($price <= 0) {
        echo json_encode(['success' => false, 'message' => 'Promo price must be greater than zero.']);
        exit;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $availmentDeadline)) {
        echo json_encode(['success' => false, 'message' => 'Please provide a valid availment deadline.']);
        exit;
    }
    if ($availmentDeadline < date('Y-m-d')) {
        echo json_encode(['success' => false, 'message' => 'The availment deadline cannot be in the past.']);
        exit;
    }
    if ($imageUrl !== '' && !preg_match('/^https?:\/\//i', $imageUrl) && !preg_match('/^session_uploads\/[A-Za-z0-9._-]+$/', $imageUrl)) {
        echo json_encode(['success' => false, 'message' => 'Invalid promo image path.']);
        exit;
    }

    try {
        if ($promoId > 0) {
            $stmt = $conn->prepare("UPDATE dbo.promotions SET promo_name=?, price=?, duration_days=?, availment_deadline=?, image_url=?, updated_at=GETDATE() WHERE id=?");
            $stmt->execute([$promoName, $price, $durationDays, $availmentDeadline, $imageUrl !== '' ? $imageUrl : null, $promoId]);
            $message = 'Promotion updated successfully.';
        } else {
            $stmt = $conn->prepare("INSERT INTO dbo.promotions (promo_name, price, duration_days, availment_deadline, image_url) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$promoName, $price, $durationDays, $availmentDeadline, $imageUrl !== '' ? $imageUrl : null]);
            $message = 'Promotion created successfully.';
        }
        echo json_encode(['success' => true, 'message' => $message]);
    } catch (PDOException $e) {
        error_log('Save promotion error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Unable to save promotion.']);
    }
    exit;
}

if ($method === 'POST' && $action === 'end_promo') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }

    $promoId = (int) ($input['promo_id'] ?? 0);
    if ($promoId <= 0) {
        echo json_encode(['success' => false, 'message' => 'A valid promo ID is required.']);
        exit;
    }

    try {
        $stmt = $conn->prepare("UPDATE dbo.promotions SET is_active = 0, updated_at = GETDATE() WHERE id = ? AND is_active = 1");
        $stmt->execute([$promoId]);

        if ($stmt->rowCount() === 0) {
            echo json_encode(['success' => false, 'message' => 'This promo is already inactive.']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'Promotion ended successfully.']);
    } catch (PDOException $e) {
        error_log('End promo error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Unable to end the promotion.']);
    }
    exit;
}

if ($method === 'POST' && $action === 'delete_promo') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }

    $promoId = (int) ($input['promo_id'] ?? 0);
    if ($promoId <= 0) {
        echo json_encode(['success' => false, 'message' => 'A valid promo ID is required.']);
        exit;
    }

    try {
        $stmt = $conn->prepare(
            "DELETE FROM dbo.promotions
             WHERE id = ?
               AND NOT EXISTS (
                   SELECT 1 FROM dbo.promo_availments WHERE promo_id = ?
               )"
        );
        $stmt->execute([$promoId, $promoId]);
        if ($stmt->rowCount() === 0) {
            $exists = $conn->prepare("SELECT COUNT(*) FROM dbo.promotions WHERE id = ?");
            $exists->execute([$promoId]);
            if ((int) $exists->fetchColumn() === 0) {
                echo json_encode(['success' => false, 'message' => 'Promotion not found.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'This promotion has member availment records and cannot be deleted. End the promotion to preserve its history.']);
            }
            exit;
        }

        auditAdminActionDetail($conn, $authUser, $action, "deleted promotion {$promoId}");
        echo json_encode(['success' => true, 'message' => 'Promotion deleted successfully.']);
    } catch (PDOException $e) {
        error_log('Delete promotion error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Unable to delete the promotion. It may have associated member records.']);
    }
    exit;
}

if ($method === 'POST' && $action === 'avail_promo') {
    $memberId = (int) ($authUser['sub'] ?? 0);
    $promoId = (int) ($input['promo_id'] ?? 0);
    $paymentMethod = trim((string) ($input['payment_method'] ?? 'Cash'));
    if ($paymentMethod === '') {
        $paymentMethod = 'Cash';
    }
    if ($memberId <= 0 || $promoId <= 0) {
        echo json_encode(['success' => false, 'message' => 'A valid member and promotion are required.']);
        exit;
    }

    try {
        $promoStmt = $conn->prepare("SELECT id, promo_name, price, duration_days FROM dbo.promotions WHERE id=? AND is_active=1 AND CAST(GETDATE() AS DATE) <= availment_deadline");
        $promoStmt->execute([$promoId]);
        $promo = $promoStmt->fetch(PDO::FETCH_ASSOC);
        if (!$promo) {
            echo json_encode(['success' => false, 'message' => 'This promotion is no longer available.']);
            exit;
        }

        $existingStmt = $conn->prepare(
            "SELECT TOP 1 id, status, expiration_date
             FROM dbo.promo_availments
             WHERE member_id = ? AND promo_id = ?"
        );
        $existingStmt->execute([$memberId, $promoId]);
        $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            $existingStatus = strtolower((string) ($existing['status'] ?? ''));
            if ($existingStatus === 'active') {
                echo json_encode(['success' => false, 'message' => 'You have already availed this promotion.']);
                exit;
            }

            if ($existingStatus === 'pending') {
                echo json_encode(['success' => false, 'message' => 'This promotion request is already pending for your account.']);
                exit;
            }
        }

        $memberStmt = $conn->prepare("SELECT full_name FROM dbo.members WHERE memberID=? AND deleted_at IS NULL");
        $memberStmt->execute([$memberId]);
        $member = $memberStmt->fetch(PDO::FETCH_ASSOC);
        if (!$member) {
            echo json_encode(['success' => false, 'message' => 'Member account not found.']);
            exit;
        }

        $conn->beginTransaction();
        $entitlementStmt = $conn->prepare("INSERT INTO dbo.promo_availments (promo_id, member_id, availed_at, expiration_date, status) OUTPUT INSERTED.id VALUES (?, ?, GETDATE(), NULL, 'pending')");
        $entitlementStmt->execute([$promoId, $memberId]);
        $availmentId = (int) $entitlementStmt->fetchColumn();
        $paymentStmt = $conn->prepare("INSERT INTO dbo.payments (member_id, payment_type, session_id, amount, payment_method, payment_status, payment_date, notes) VALUES (?, 'PROMOTION', NULL, ?, ?, 'pending', GETDATE(), ?)");
        $paymentStmt->execute([$memberId, (float) $promo['price'], $paymentMethod, 'Promo ID: ' . $promoId . ' - ' . $promo['promo_name'] . ' - Availment ID: ' . $availmentId]);
        $paymentLookup = $conn->prepare("SELECT TOP 1 payment_id FROM dbo.payments WHERE member_id=? AND payment_type='PROMOTION' AND payment_status='pending' AND notes LIKE ? ORDER BY payment_id DESC");
        $paymentLookup->execute([$memberId, '%Availment ID: ' . $availmentId . '%']);
        $paymentId = (int) $paymentLookup->fetchColumn();
        $conn->prepare("UPDATE dbo.promo_availments SET payment_id=? WHERE id=?")->execute([$paymentId, $availmentId]);
        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Promotion request submitted. It will become active after payment confirmation.', 'payment_status' => 'pending']);
    } catch (PDOException $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }

        $message = strtolower($e->getMessage());
        if (str_contains($message, 'uq_promo_availment_member') || str_contains($message, 'duplicate')) {
            echo json_encode(['success' => false, 'message' => 'You already requested this promotion.']);
            exit;
        }

        error_log('Avail promo error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Unable to avail this promotion right now.']);
    }
    exit;
}

if ($method === 'POST' && $action === 'save_session_type') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }

    $id = (int) ($input['id'] ?? 0);
    $name = trim((string) ($input['session_name'] ?? ''));
    $price = (float) ($input['price'] ?? 0);
    $imageUrl = trim((string) ($input['image_url'] ?? ''));

    if ($name === '') {
        echo json_encode(['success' => false, 'message' => 'Session type name is required.']);
        exit;
    }
    if ($price < 0) {
        echo json_encode(['success' => false, 'message' => 'Price cannot be negative.']);
        exit;
    }

    if (
        $imageUrl !== '' &&
        !preg_match('/^https?:\/\//i', $imageUrl) &&
        !preg_match('/^session_uploads\/[A-Za-z0-9._-]+$/', $imageUrl)
    ) {
        echo json_encode(['success' => false, 'message' => 'Invalid session image path.']);
        exit;
    }

    try {
        ensureSessionCatalog($conn);

        if ($id > 0) {
            if ($imageUrl !== '') {
                $stmt = $conn->prepare("UPDATE dbo.gym_session_types SET session_name=?, price=?, image_url=?, updated_at=GETDATE() WHERE id=?");
                $stmt->execute([$name, $price, $imageUrl, $id]);
            } else {
                $stmt = $conn->prepare("UPDATE dbo.gym_session_types SET session_name=?, price=?, updated_at=GETDATE() WHERE id=?");
                $stmt->execute([$name, $price, $id]);
            }

            $message = 'Session type updated successfully.';
            auditAdminActionDetail($conn, $authUser, $action, "updated session type {$name}");
        } else {
            $stmt = $conn->prepare("INSERT INTO dbo.gym_session_types (session_name,price,image_url) VALUES (?,?,?)");
            $stmt->execute([$name, $price, $imageUrl !== '' ? $imageUrl : null]);
            $message = 'Session type created successfully.';
            auditAdminActionDetail($conn, $authUser, $action, "added session type {$name}");
        }

        echo json_encode(['success' => true, 'message' => $message]);
    } catch (PDOException $e) {
        $msg = stripos($e->getMessage(), 'UNIQUE') !== false
            ? 'A session type with this name already exists.'
            : 'Database error: ' . $e->getMessage();

        echo json_encode(['success' => false, 'message' => $msg]);
    }
    exit;
}

if ($method === 'POST' && $action === 'delete_session_type') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Session type ID is required.']);
        exit;
    }
    try {
        ensureSessionCatalog($conn);
        $stmt = $conn->prepare("UPDATE dbo.gym_session_types SET is_active=0, updated_at=GETDATE() WHERE id=? AND is_active=1");
        $stmt->execute([$id]);
        if ($stmt->rowCount() > 0) {
            $nameStmt = $conn->prepare('SELECT session_name FROM dbo.gym_session_types WHERE id = ?');
            $nameStmt->execute([$id]);
            auditAdminActionDetail($conn, $authUser, $action, 'deleted session type ' . (string)$nameStmt->fetchColumn());
            echo json_encode(['success' => true, 'message' => 'Session type deactivated successfully.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Session type not found or already deactivated.']);
        }
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST' && $action === 'activate_session_type') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Session type ID is required.']);
        exit;
    }
    try {
        ensureSessionCatalog($conn);
        $stmt = $conn->prepare("UPDATE dbo.gym_session_types SET is_active=1, updated_at=GETDATE() WHERE id=?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() > 0) {
            $nameStmt = $conn->prepare('SELECT session_name FROM dbo.gym_session_types WHERE id = ?');
            $nameStmt->execute([$id]);
            auditAdminActionDetail($conn, $authUser, $action, 'activated session type ' . (string)$nameStmt->fetchColumn());
            echo json_encode(['success' => true, 'message' => 'Session type activated successfully.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Session type not found or already active.']);
        }
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_create_session') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }
    $trainer_id = (int) ($input['trainer_id'] ?? 0);
    $session_type = trim((string) ($input['session_type'] ?? ''));
    $start = trim((string) ($input['start_time'] ?? ''));
    $end = trim((string) ($input['end_time'] ?? ''));
    $maxParticipants = normalizeMaxParticipants($input['max_participants'] ?? ($input['maxParticipants'] ?? 1));
    if ($trainer_id <= 0 || $session_type === '' || $start === '' || $end === '') {
        echo json_encode(['success' => false, 'message' => 'Trainer, session type, start time, and end time are required.']);
        exit;
    }
    if ($maxParticipants < 1) {
        echo json_encode(['success' => false, 'message' => 'Max participants must be at least 1.']);
        exit;
    }
    if (strtotime($end) <= strtotime($start)) {
        echo json_encode(['success' => false, 'message' => 'End time must be after start time.']);
        exit;
    }
    if (strtotime($start) <= time() || strtotime($end) <= time()) {
        echo json_encode(['success' => false, 'message' => 'The selected time/date has already passed. Please create another session.']);
        exit;
    }
    try {
        ensureSessionCatalog($conn);
        ensureTrainerSessionColumns($conn);
        $tr = $conn->prepare("SELECT trainerID, full_name FROM trainers WHERE trainerID=? AND status='Active'");
        $tr->execute([$trainer_id]);
        $trainer = $tr->fetch(PDO::FETCH_ASSOC);
        $tr->closeCursor();
        if (!$trainer) {
            echo json_encode(['success' => false, 'message' => 'Trainer not found or inactive.']);
            exit;
        }
        $pt = $conn->prepare("SELECT price FROM dbo.gym_session_types WHERE session_name=? AND is_active=1");
        $pt->execute([$session_type]);
        $cat = $pt->fetch(PDO::FETCH_ASSOC);
        $pt->closeCursor();
        if (!$cat) {
            echo json_encode(['success' => false, 'message' => 'Session type is not active.']);
            exit;
        }
        $overlap = $conn->prepare("SELECT COUNT(*) AS count FROM trainer_sessions WHERE trainer_id=? AND status IN ('pending','approved') AND start_time < ? AND end_time > ?");
        $overlap->execute([$trainer_id, $end, $start]);
        $overlapRow = $overlap->fetch(PDO::FETCH_ASSOC);
        $overlap->closeCursor();
        if ((int) $overlapRow['count'] > 0) {
            echo json_encode(['success' => false, 'message' => 'This trainer already has another session scheduled during that time.']);
            exit;
        }
        $stmt = $conn->prepare("INSERT INTO trainer_sessions (trainer_id,session_type,start_time,end_time,price,max_participants,status,created_at,admin_notes) VALUES (?,?,?,?,?,?, 'approved',GETDATE(),'Created by admin')");
        $stmt->execute([$trainer_id, $session_type, $start, $end, (float) $cat['price'], $maxParticipants]);
        auditAdminActionDetail($conn, $authUser, $action, "created {$session_type} session for {$trainer['full_name']}");
        echo json_encode(['success' => true, 'message' => 'Session created and approved successfully.', 'trainer_name' => $trainer['full_name']]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_create_pickleball_session') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }

    $availabilityDate = trim((string) ($input['availability_date'] ?? ''));
    $maxParticipantsRaw = trim((string) ($input['max_participants'] ?? ''));
    $durationMinutesRaw = trim((string) ($input['duration_minutes'] ?? ''));
    if (
        !preg_match('/^\d+$/', $maxParticipantsRaw) || (int) $maxParticipantsRaw < 1 ||
        !preg_match('/^\d+$/', $durationMinutesRaw) || (int) $durationMinutesRaw < 30 ||
        (int) $durationMinutesRaw > 720 || (int) $durationMinutesRaw % 30 !== 0
    ) {
        echo json_encode(['success' => false, 'message' => 'Enter a participant limit and a duration between 0.5 and 12 hours in 30-minute increments.']);
        exit;
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $availabilityDate);
    if (!$date || $date->format('Y-m-d') !== $availabilityDate) {
        echo json_encode(['success' => false, 'message' => 'A valid availability date is required.']);
        exit;
    }

    $start = $date->setTime(9, 0);
    $end = $start->modify('+' . (int) $durationMinutesRaw . ' minutes');

    try {
        ensureSessionCatalog($conn);
        ensureTrainerSessionColumns($conn);
        ensureCoachlessTrainerSessions($conn);

        $serverDate = (string) $conn->query("SELECT CONVERT(VARCHAR(10), CAST(GETDATE() AS DATE), 23)")->fetchColumn();
        if ($availabilityDate <= $serverDate) {
            echo json_encode(['success' => false, 'message' => 'Availability date must be after today. Pickleball sessions start at 9:00 AM.']);
            exit;
        }

        $priceStmt = $conn->prepare("SELECT TOP 1 price FROM dbo.gym_session_types WHERE session_name = N'Pickleball' AND is_active = 1");
        $priceStmt->execute();
        $price = $priceStmt->fetchColumn();
        if ($price === false) {
            echo json_encode(['success' => false, 'message' => 'Activate the Pickleball session type in Pricing & Types before creating a session.']);
            exit;
        }

        $insert = $conn->prepare("INSERT INTO dbo.trainer_sessions
            (trainer_id, session_type, start_time, end_time, price, max_participants, status, created_at, admin_notes)
            VALUES (NULL, N'Pickleball', ?, ?, ?, ?, 'approved', GETDATE(), ?)");
        $notes = 'Pickleball availability date; duration ' . (int) $durationMinutesRaw . ' minutes.';
        $insert->execute([
            $start->format('Y-m-d H:i:s'),
            $end->format('Y-m-d H:i:s'),
            (float) $price,
            (int) $maxParticipantsRaw,
            $notes,
        ]);

        auditAdminActionDetail($conn, $authUser, $action, "created Pickleball session for {$availabilityDate} with capacity {$maxParticipantsRaw}");
        echo json_encode(['success' => true, 'message' => 'Pickleball session created and made available to members.']);
    } catch (PDOException $e) {
        error_log('Create pickleball session error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_update_session') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }
    $id = (int) ($input['session_id'] ?? 0);
    $trainer_id = (int) ($input['trainer_id'] ?? 0);
    $type = trim((string) ($input['session_type'] ?? ''));
    $start = trim((string) ($input['start_time'] ?? ''));
    $end = trim((string) ($input['end_time'] ?? ''));
    $maxParticipants = normalizeMaxParticipants($input['max_participants'] ?? ($input['maxParticipants'] ?? 1));
    if ($id <= 0 || $trainer_id <= 0 || $type === '' || $start === '' || $end === '') {
        echo json_encode(['success' => false, 'message' => 'All session fields are required.']);
        exit;
    }
    if ($maxParticipants < 1) {
        echo json_encode(['success' => false, 'message' => 'Max participants must be at least 1.']);
        exit;
    }
    if (strtotime($end) <= strtotime($start)) {
        echo json_encode(['success' => false, 'message' => 'End time must be after start time.']);
        exit;
    }
    if (strtotime($start) <= time() || strtotime($end) <= time()) {
        echo json_encode(['success' => false, 'message' => 'The selected time/date has already passed. Please create another session.']);
        exit;
    }
    try {
        ensureSessionCatalog($conn);
        ensureTrainerSessionColumns($conn);
        $booking = $conn->prepare("SELECT COUNT(*) AS count FROM member_session_enrollments WHERE session_id=? AND status IN ('pending','paid')");
        $booking->execute([$id]);
        $bc = $booking->fetch(PDO::FETCH_ASSOC);
        $booking->closeCursor();
        if ((int) $bc['count'] > 0) {
            echo json_encode(['success' => false, 'message' => 'This session already has a member booked and cannot be edited.']);
            exit;
        }
        $pt = $conn->prepare("SELECT price FROM dbo.gym_session_types WHERE session_name=? AND is_active=1");
        $pt->execute([$type]);
        $cat = $pt->fetch(PDO::FETCH_ASSOC);
        $pt->closeCursor();
        if (!$cat) {
            echo json_encode(['success' => false, 'message' => 'Session type is not active.']);
            exit;
        }
        $overlap = $conn->prepare("SELECT COUNT(*) AS count FROM trainer_sessions WHERE trainer_id=? AND id<>? AND status IN ('pending','approved') AND start_time < ? AND end_time > ?");
        $overlap->execute([$trainer_id, $id, $end, $start]);
        $overlapRow = $overlap->fetch(PDO::FETCH_ASSOC);
        $overlap->closeCursor();
        if ((int) $overlapRow['count'] > 0) {
            echo json_encode(['success' => false, 'message' => 'This trainer already has another session scheduled during that time.']);
            exit;
        }
        $stmt = $conn->prepare("UPDATE trainer_sessions SET trainer_id=?,session_type=?,start_time=?,end_time=?,price=?,max_participants=? WHERE id=? AND start_time>GETDATE() AND status IN ('pending','approved') AND is_booked=0");
        $stmt->execute([$trainer_id, $type, $start, $end, (float) $cat['price'], $maxParticipants, $id]);
        $trainerNameStmt = $conn->prepare('SELECT full_name FROM trainers WHERE trainerID = ?');
        $trainerNameStmt->execute([$trainer_id]);
        $trainerName = (string) $trainerNameStmt->fetchColumn();
        if ($stmt->rowCount() > 0) {
            auditAdminActionDetail($conn, $authUser, $action, "Updated {$type} session for trainer {$trainerName}");
        }
        echo json_encode(['success' => $stmt->rowCount() > 0, 'message' => $stmt->rowCount() > 0 ? 'Session updated successfully.' : 'Session cannot be updated. It may be booked, started, or already terminated.']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST' && $action === 'start_session') {
    $sessionId = (int) ($input['session_id'] ?? 0);
    $trainerId = (int) ($authUser['sub'] ?? 0);
    if ($sessionId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required.']);
        exit;
    }

    try {
        $stmt = $conn->prepare(
            "UPDATE trainer_sessions
             SET status = 'ongoing'
             WHERE id = ? AND trainer_id = ? AND status = 'approved'
               AND start_time <= GETDATE() AND end_time > GETDATE()"
        );
        $stmt->execute([$sessionId, $trainerId]);
        if ($stmt->rowCount() === 0) {
            echo json_encode(['success' => false, 'message' => 'This session cannot be started yet or has already ended.']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'Session started and is now ongoing.']);
    } catch (Throwable $e) {
        error_log('Start trainer session error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Unable to start the session.']);
    }
    exit;
}

if ($method === 'POST' && $action === 'finish_session') {
    $sessionId = (int) ($input['session_id'] ?? 0);
    $trainerId = (int) ($authUser['sub'] ?? 0);
    $reason = trim((string) ($input['reason'] ?? 'Finished by trainer before scheduled end time.'));
    if ($sessionId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required.']);
        exit;
    }

    try {
        $stmt = $conn->prepare(
            "UPDATE trainer_sessions
             SET status = 'finished', admin_notes = COALESCE(NULLIF(admin_notes, ''), ?)
             WHERE id = ? AND trainer_id = ? AND status IN ('ongoing', 'approved')
               AND start_time <= GETDATE()"
        );
        $stmt->execute([$reason, $sessionId, $trainerId]);
        if ($stmt->rowCount() === 0) {
            echo json_encode(['success' => false, 'message' => 'Only an active session can be marked as finished.']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'Session marked as finished successfully.']);
    } catch (Throwable $e) {
        error_log('Finish trainer session error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Unable to finish the session.']);
    }
    exit;
}

if ($method === 'POST' && $action === 'trainer_terminate_session') {
    $sessionId = (int) ($input['session_id'] ?? 0);
    $trainerId = (int) ($authUser['sub'] ?? 0);
    $reason = trim((string) ($input['reason'] ?? 'Terminated by trainer.'));
    if ($sessionId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required.']);
        exit;
    }

    try {
        $stmt = $conn->prepare(
            "UPDATE trainer_sessions
             SET status = 'terminated', admin_notes = ?
             WHERE id = ? AND trainer_id = ? AND status IN ('approved', 'ongoing')
               AND status <> 'finished' AND status <> 'terminated'"
        );
        $stmt->execute([$reason, $sessionId, $trainerId]);
        if ($stmt->rowCount() === 0) {
            echo json_encode(['success' => false, 'message' => 'Only an approved or ongoing session can be terminated.']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'Session terminated successfully.']);
    } catch (Throwable $e) {
        error_log('Terminate trainer session error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Unable to terminate the session.']);
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_terminate_session') {
    $admin = validateAdmin($conn, $input['admin_id'] ?? 0);
    if (!$admin) {
        echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
        exit;
    }
    $id = (int) ($input['session_id'] ?? 0);
    $reason = trim((string) ($input['reason'] ?? 'Session terminated by admin.'));
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required.']);
        exit;
    }
    try {
        $conn->beginTransaction();
        $stmt = $conn->prepare("SELECT id,start_time,status,is_booked FROM trainer_sessions WITH (UPDLOCK,ROWLOCK) WHERE id=?");
        $stmt->execute([$id]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();
        if (!$session) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'Session not found.']);
            exit;
        }
        if (!in_array(strtolower((string) ($session['status'] ?? '')), ['approved', 'ongoing'], true)) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'Only an approved or ongoing session can be terminated.']);
            exit;
        }
        $booking = $conn->prepare("SELECT COUNT(*) AS count FROM member_session_enrollments WHERE session_id=? AND status IN ('pending','paid')");
        $booking->execute([$id]);
        $bc = $booking->fetch(PDO::FETCH_ASSOC);
        $booking->closeCursor();
        if ((int) $bc['count'] > 0 || (int) $session['is_booked'] === 1) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'This session is already booked and cannot be terminated from Session Management.']);
            exit;
        }
        $trainerInfo = $conn->prepare("SELECT ts.trainer_id, ts.session_type, ts.start_time, t.full_name AS trainer_name
                           FROM trainer_sessions ts
                           LEFT JOIN trainers t ON t.trainerID = ts.trainer_id
                           WHERE ts.id = ?");
        $trainerInfo->execute([$id]);
        $trainerSession = $trainerInfo->fetch(PDO::FETCH_ASSOC);
        $trainerInfo->closeCursor();

        $upd = $conn->prepare("UPDATE trainer_sessions SET status='terminated',admin_notes=? WHERE id=?");
        $upd->execute([$reason, $id]);
        $conn->commit();
        auditAdminActionDetail($conn, $authUser, $action, "Terminated {$trainerSession['session_type']} session for trainer {$trainerSession['trainer_name']}");

        if ($trainerSession && (int) ($trainerSession['trainer_id'] ?? 0) > 0) {
            $notification = $conn->prepare(
                "INSERT INTO notifications (title, message, type, role, recipient_id, is_read, created_at)
                 VALUES (?, ?, ?, 'trainer', ?, 0, GETDATE())"
            );
            $notification->execute([
                'Session terminated',
                "Your {$trainerSession['session_type']} session scheduled for " . date('M j, Y g:i A', strtotime((string) ($trainerSession['start_time'] ?? date('Y-m-d H:i:s')))) . " has been terminated. Reason: " . ($reason !== '' ? $reason : 'No reason provided.'),
                'warning',
                (int) $trainerSession['trainer_id']
            ]);
        }

        echo json_encode(['success' => true, 'message' => 'Session terminated successfully.']);
    } catch (PDOException $e) {
        if ($conn->inTransaction())
            $conn->rollBack();
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}




if ($method === 'POST' && $action === 'create_trainer_session') {
    $trainer_id = $input['trainer_id'] ?? '';
    $trainer_id = (int) $trainer_id;
    $session_type = $input['session_type'] ?? 'Weight Lifting';
    $start_time = $input['start_time'] ?? '';
    $end_time = $input['end_time'] ?? '';
    $max_participants = normalizeMaxParticipants($input['max_participants'] ?? ($input['maxParticipants'] ?? 1));
    $price = $input['price'] ?? null;

    if (empty($trainer_id) || empty($start_time) || empty($end_time)) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    if ($max_participants < 1) {
        echo json_encode(['success' => false, 'message' => 'Max participants must be at least 1']);
        exit;
    }

    if (strtotime((string) $start_time) <= time() || strtotime((string) $end_time) <= time()) {
        echo json_encode(['success' => false, 'message' => 'The selected time/date has already passed. Please create another session.']);
        exit;
    }

    if (strtotime((string) $end_time) <= strtotime((string) $start_time)) {
        echo json_encode(['success' => false, 'message' => 'End time must be after start time.']);
        exit;
    }

    try {
        ensureTrainerSessionColumns($conn);
        $checkTrainerSql = "SELECT trainerID, full_name FROM trainers WHERE trainerID = ? AND status = 'Active'";
        $checkTrainerStmt = $conn->prepare($checkTrainerSql);
        $checkTrainerStmt->execute([$trainer_id]);
        $trainer = $checkTrainerStmt->fetch(PDO::FETCH_ASSOC);

        if (!$trainer) {
            echo json_encode(['success' => false, 'message' => 'Trainer not found or inactive']);
            exit;
        }

        ensureSessionCatalog($conn);
        $priceStmt = $conn->prepare("SELECT price FROM dbo.gym_session_types WHERE session_name = ? AND is_active = 1");
        $priceStmt->execute([$session_type]);
        $catalog = $priceStmt->fetch(PDO::FETCH_ASSOC);
        $priceStmt->closeCursor();
        if (!$catalog) {
            echo json_encode(['success' => false, 'message' => 'Session type is not available.']);
            exit;
        }
        $price = (float) $catalog['price'];

        $sql = "INSERT INTO trainer_sessions (trainer_id, session_type, start_time, end_time, price, max_participants, status, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, 'pending', GETDATE())";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$trainer_id, $session_type, $start_time, $end_time, $price, $max_participants]);

        $result = $conn->query("SELECT SCOPE_IDENTITY() as last_id");
        $row = $result->fetch(PDO::FETCH_ASSOC);
        $newSessionId = $row['last_id'];

        echo json_encode([
            'success' => true,
            'message' => 'Session created successfully! Waiting for admin approval.',
            'session_id' => $newSessionId,
            'status' => 'pending'
        ]);
    } catch (PDOException $e) {
        error_log("Create session error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'GET' && $action === 'get_trainer_profile') {
    if (strtolower((string) ($authUser['role'] ?? '')) !== 'trainer') {
        authError('Only trainers can access their own profile.');
    }
    try {
        $trainerId = (int) ($authUser['sub'] ?? 0);
        if ($trainerId <= 0) {
            authError('Valid trainer account is required.');
        }

        $stmt = $conn->prepare(
            "SELECT trainerID, full_name, email, phone_number, age, role, expertise_area, status, profile_photo
             FROM trainers
             WHERE trainerID = ? AND deleted_at IS NULL"
        );
        $stmt->execute([$trainerId]);
        $trainer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$trainer) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Trainer profile not found.']);
            exit;
        }

        if (isset($trainer['profile_photo'])) {
            $trainer['profile_photo'] = normalizeAssetUrl($trainer['profile_photo']);
        }

        echo json_encode([
            'success' => true,
            'profile' => $trainer
        ]);
    } catch (PDOException $e) {
        error_log("Get trainer profile error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error while loading trainer profile.'
        ]);
    }
    exit;
}


if ($method === 'POST' && $action === 'update_trainer_profile') {
    if (strtolower((string) ($authUser['role'] ?? '')) !== 'trainer') {
        authError('Only trainers can update their own profile.');
    }
    try {
        $trainerId = (int) ($authUser['sub'] ?? 0);
        if ($trainerId <= 0) {
            authError('Valid trainer account is required.');
        }

        $fullName = trim((string) ($input['full_name'] ?? ''));
        $email = trim((string) ($input['email'] ?? ''));
        $phone = trim((string) ($input['phone_number'] ?? $input['phone'] ?? ''));
        $expertise = trim((string) ($input['expertise_area'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        $profilePhoto = trim((string) ($input['profile_photo'] ?? ''));

        if ($profilePhoto !== '' && !str_starts_with($profilePhoto, 'http://') && !str_starts_with($profilePhoto, 'https://')) {
            if (!preg_match('/^data:image\/(jpeg|png|webp);base64,(.+)$/', $profilePhoto, $matches)) {
                echo json_encode(['success' => false, 'message' => 'Please upload a JPG, PNG, or WebP image.']);
                exit;
            }
            $image = base64_decode($matches[2], true);
            if ($image === false || strlen($image) > 5 * 1024 * 1024) {
                echo json_encode(['success' => false, 'message' => 'Profile photo must be 5 MB or smaller.']);
                exit;
            }
            $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
            $directory = __DIR__ . '/../profile_uploads/';
            if (!is_dir($directory)) mkdir($directory, 0777, true);
            $fileName = 'trainer_' . $trainerId . '_' . time() . '.' . $extension;
            file_put_contents($directory . $fileName, $image);
            $profilePhoto = buildAppBaseUrl('profile_uploads/' . $fileName);
        }

        if ($fullName === '' || $email === '') {
            echo json_encode(['success' => false, 'message' => 'Full name and email are required.']);
            exit;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'Enter a valid email address.']);
            exit;
        }
        if ($phone !== '' && !preg_match('/^09\d{9}$/', $phone)) {
            echo json_encode(['success' => false, 'message' => 'Enter a valid Philippine mobile number (09XXXXXXXXX).']);
            exit;
        }
        if ($password !== '' && strlen($password) < 6) {
            echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters.']);
            exit;
        }

        $emailCheck = $conn->prepare(
            "SELECT trainerID FROM trainers WHERE email = ? AND trainerID <> ? AND deleted_at IS NULL"
        );
        $emailCheck->execute([$email, $trainerId]);
        if ($emailCheck->fetch(PDO::FETCH_ASSOC)) {
            echo json_encode(['success' => false, 'message' => 'Email already exists.']);
            exit;
        }

        if ($profilePhoto !== '') {
            $sql = "UPDATE trainers SET full_name = ?, email = ?, phone_number = ?, expertise_area = ?, profile_photo = ?" . ($password !== '' ? ", password = ?" : '') . ", updated_at = GETDATE() WHERE trainerID = ? AND deleted_at IS NULL";
            $params = [$fullName, $email, $phone, $expertise, $profilePhoto];
            if ($password !== '') $params[] = password_hash($password, PASSWORD_DEFAULT);
            $params[] = $trainerId;
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
        } elseif ($password !== '') {
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $conn->prepare(
                "UPDATE trainers
                 SET full_name = ?, email = ?, phone_number = ?, expertise_area = ?, password = ?, updated_at = GETDATE()
                 WHERE trainerID = ? AND deleted_at IS NULL"
            );
            $stmt->execute([$fullName, $email, $phone, $expertise, $hashedPassword, $trainerId]);
        } else {
            $stmt = $conn->prepare(
                "UPDATE trainers
                 SET full_name = ?, email = ?, phone_number = ?, expertise_area = ?, updated_at = GETDATE()
                 WHERE trainerID = ? AND deleted_at IS NULL"
            );
            $stmt->execute([$fullName, $email, $phone, $expertise, $trainerId]);
        }

        $profileStmt = $conn->prepare(
            "SELECT trainerID, full_name, email, phone_number, age, role, expertise_area, status, profile_photo
             FROM trainers
             WHERE trainerID = ? AND deleted_at IS NULL"
        );
        $profileStmt->execute([$trainerId]);
        $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);

        if ($profile && isset($profile['profile_photo'])) {
            $profile['profile_photo'] = normalizeAssetUrl($profile['profile_photo']);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Trainer profile updated successfully.',
            'profile' => $profile
        ]);
    } catch (PDOException $e) {
        error_log("Update trainer profile error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error while updating trainer profile.'
        ]);
    }
    exit;
}


if ($method === 'GET' && $action === 'get_trainer_sessions') {
    $trainer_id = isset($_GET['trainer_id']) ? $_GET['trainer_id'] : '';
    $trainer_id = (int) $trainer_id;

    if (empty($trainer_id)) {
        echo json_encode(['success' => false, 'message' => 'Trainer ID is required']);
        exit;
    }

    try {
        ensureTrainerSessionColumns($conn);
        finalizePastSessions($conn);

        $sql = "SELECT id, trainer_id, session_type, start_time, end_time, price, max_participants, rating, status, admin_notes, created_at, rated_by,
                       (SELECT COUNT(*) FROM member_session_enrollments mse WHERE mse.session_id = trainer_sessions.id AND mse.status IN ('pending','paid')) AS booking_count
                FROM trainer_sessions 
                WHERE trainer_id = ? 
                ORDER BY created_at DESC";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$trainer_id]);
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'sessions' => $sessions
        ]);
    } catch (PDOException $e) {
        error_log("Get sessions error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'GET' && $action === 'get_available_sessions') {
    try {
        ensureTrainerSessionColumns($conn);
        finalizePastSessions($conn);
        $sql = "SELECT ts.id, ts.trainer_id, ts.session_type, ts.start_time, ts.end_time, DATEDIFF(MINUTE, ts.start_time, ts.end_time) AS duration_minutes, ts.price, ts.max_participants, ts.rating, ts.status, ts.created_at, ts.admin_notes, ts.rated_by, ts.is_booked, ts.is_paid, ts.booked_by, ts.booked_at, ts.booked_by_name,
                       t.full_name as trainer_name, t.expertise_area as specialization,
                       (SELECT COUNT(*) FROM member_session_enrollments mse WHERE mse.session_id = ts.id AND mse.status IN ('pending','paid')) as booking_count
                FROM trainer_sessions ts
                LEFT JOIN trainers t ON ts.trainer_id = t.trainerID
                WHERE ts.status = 'approved'
                AND ts.start_time > GETDATE()
                ORDER BY ts.start_time ASC";
        $stmt = $conn->query($sql);
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($sessions as &$session) {
            $bookingCount = (int) ($session['booking_count'] ?? 0);
            $maxParticipants = max(1, (int) ($session['max_participants'] ?? 1));
            $session['is_booked'] = $bookingCount >= $maxParticipants;
            $session['booking_count'] = $bookingCount;
        }
        unset($session);

        echo json_encode([
            'success' => true,
            'sessions' => $sessions
        ]);
    } catch (PDOException $e) {
        error_log("Get available sessions error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'GET' && $action === 'get_my_sessions') {
    if (strtolower((string) ($authUser['role'] ?? '')) === 'member' && isset($_GET['member_id']) && (int) $_GET['member_id'] !== (int) $authUser['sub'])
        authError('You can only view your own booked sessions.');
    $member_id = strtolower((string) ($authUser['role'] ?? '')) === 'member' ? (int) $authUser['sub'] : (isset($_GET['member_id']) ? (int) $_GET['member_id'] : 0);
    $member_email = strtolower((string) ($authUser['role'] ?? '')) === 'member' ? (string) ($authUser['email'] ?? '') : trim($_GET['member_email'] ?? '');

    try {
        ensureTrainerSessionColumns($conn);
        ensureMemberSessionRatings($conn);
        $member = resolveMemberId($conn, $member_id, $member_email);
        if (!$member) {
            echo json_encode([
                'success' => false,
                'message' => 'Your member account could not be verified automatically.'
            ]);
            exit;
        }
        $member_id = (int) $member['memberID'];
        $sql = "SELECT ts.id, ts.trainer_id, ts.session_type, ts.start_time, ts.end_time, DATEDIFF(MINUTE, ts.start_time, ts.end_time) AS duration_minutes, ts.price, ts.max_participants, ts.rating, msr.rating AS member_rating, ts.status, ts.created_at, ts.admin_notes, ts.rated_by, ts.is_booked, ts.is_paid, ts.booked_by, ts.booked_at, ts.booked_by_name,
                       t.full_name as trainer_name, t.expertise_area as specialization,
                      mse.booking_date,
                      (
                        SELECT COUNT(*)
                        FROM member_session_enrollments mse2
                        WHERE mse2.session_id = ts.id
                          AND mse2.status IN ('pending', 'paid')
                      ) AS booking_count,
                      CASE
                        WHEN LOWER(COALESCE(p.payment_status, mse.status)) = 'paid' THEN 'paid'
                        WHEN LOWER(COALESCE(p.payment_status, mse.status)) = 'pending' THEN 'pending'
                        WHEN LOWER(COALESCE(mse.status, 'pending')) = 'unpaid' THEN 'unpaid'
                        ELSE LOWER(COALESCE(mse.status, 'pending'))
                      END as enrollment_status,
                      COALESCE(p.payment_status, mse.status) as trainer_payment_status
                FROM trainer_sessions ts
                LEFT JOIN trainers t ON ts.trainer_id = t.trainerID
                JOIN member_session_enrollments mse ON ts.id = mse.session_id
                                LEFT JOIN dbo.member_session_ratings msr ON msr.session_id = ts.id AND msr.member_id = mse.member_id
                  OUTER APPLY (
                      SELECT TOP 1 payment_status
                      FROM payments p
                      WHERE p.member_id = mse.member_id
                     AND p.session_id = mse.session_id
                     AND p.payment_type = 'TRAINER_SESSION'
                      ORDER BY CASE WHEN p.payment_status = 'paid' THEN 0 WHEN p.payment_status = 'pending' THEN 1 ELSE 2 END, p.payment_id DESC
                  ) p
                WHERE mse.member_id = ?
                  AND LOWER(COALESCE(mse.status, 'pending')) <> 'terminated'
                  AND LOWER(COALESCE(ts.status, 'approved')) <> 'terminated'
                ORDER BY ts.start_time ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$member_id]);
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($sessions as &$session) {
            $session['is_booked'] = (int) ($session['is_booked'] ?? 0) === 1;
            $session['is_paid'] = (int) ($session['is_paid'] ?? 0) === 1;
        }
        unset($session);

        echo json_encode([
            'success' => true,
            'sessions' => $sessions
        ]);
    } catch (PDOException $e) {
        error_log("Get my sessions error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'POST' && $action === 'book_session') {
    $member_id = (int) ($input['member_id'] ?? 0);
    $member_email = trim($input['member_email'] ?? '');
    $session_id = (int) ($input['session_id'] ?? 0);
    $member_name = trim($input['member_name'] ?? '');

    if ($session_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid session selected.']);
        exit;
    }

    try {

        $member = resolveMemberId($conn, $member_id, $member_email);
        if (!$member) {
            echo json_encode([
                'success' => false,
                'message' => 'Your member account could not be synchronized automatically. Please refresh the page and try again.'
            ]);
            exit;
        }
        $member_id = (int) $member['memberID'];
        $member_name = $member['full_name'];

        $conn->beginTransaction();

        $checkSql = "SELECT id, start_time, price, session_type, is_booked, booked_by, max_participants FROM trainer_sessions WITH (UPDLOCK, ROWLOCK) WHERE id = ? AND status = 'approved' AND start_time > GETDATE()";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->execute([$session_id]);
        $session = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$session) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'Session not available for booking']);
            exit;
        }

        $bookingCountSql = "SELECT COUNT(*) AS booking_count FROM member_session_enrollments WHERE session_id = ? AND status IN ('pending','paid')";
        $bookingCountStmt = $conn->prepare($bookingCountSql);
        $bookingCountStmt->execute([$session_id]);
        $bookingCount = (int) ($bookingCountStmt->fetch(PDO::FETCH_ASSOC)['booking_count'] ?? 0);
        $maxParticipants = max(1, (int) ($session['max_participants'] ?? 1));

        if ($bookingCount >= $maxParticipants) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => "This session is already full. Maximum participants: $maxParticipants."]);
            exit;
        }

        $checkBookingSql = "SELECT TOP 1 id, status FROM member_session_enrollments WHERE member_id = ? AND session_id = ?";
        $checkBookingStmt = $conn->prepare($checkBookingSql);
        $checkBookingStmt->execute([$member_id, $session_id]);
        $existingBooking = $checkBookingStmt->fetch(PDO::FETCH_ASSOC);
        $checkBookingStmt->closeCursor();

        if ($existingBooking && in_array(strtolower((string) $existingBooking['status']), ['pending', 'paid'], true)) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'You have already booked this session']);
            exit;
        }

        if ($existingBooking) {
            $reactivateSql = "UPDATE member_session_enrollments
                              SET booking_date = GETDATE(), enrolled_at = GETDATE(), status = 'pending'
                              WHERE id = ?";
            $reactivateStmt = $conn->prepare($reactivateSql);
            $reactivateStmt->execute([(int) $existingBooking['id']]);
        } else {
            $insertSql = "INSERT INTO member_session_enrollments (member_id, session_id, booking_date, enrolled_at, status)
                          VALUES (?, ?, GETDATE(), GETDATE(), 'pending')";
            $insertStmt = $conn->prepare($insertSql);
            $insertStmt->execute([$member_id, $session_id]);
        }

        $existingPaymentCheck = $conn->prepare(
            "SELECT TOP 1 payment_id, payment_status FROM payments
             WHERE member_id = ? AND session_id = ? AND payment_type = 'TRAINER_SESSION'
             ORDER BY payment_id DESC"
        );
        $existingPaymentCheck->execute([$member_id, $session_id]);
        $existingPaymentRecord = $existingPaymentCheck->fetch(PDO::FETCH_ASSOC);

        if (!$existingPaymentRecord) {
            $bookingPaymentSql = "INSERT INTO payments
                (member_id, payment_type, session_id, amount, payment_method, payment_status, payment_date, notes)
                VALUES (?, 'TRAINER_SESSION', ?, ?, 'Cash', 'pending', GETDATE(), 'Booking created; payment pending confirmation')";
            $bookingPaymentStmt = $conn->prepare($bookingPaymentSql);
            $bookingPaymentStmt->execute([$member_id, $session_id, (float) $session['price']]);
        }

        $updateSql = "UPDATE trainer_sessions
                      SET is_booked = CASE WHEN (SELECT COUNT(*) FROM member_session_enrollments WHERE session_id = ? AND status IN ('pending','paid')) > 0 THEN 1 ELSE 0 END,
                          booked_by = COALESCE(booked_by, ?),
                          booked_by_name = COALESCE(booked_by_name, ?),
                          booked_at = COALESCE(booked_at, GETDATE()),
                          is_paid = 0
                      WHERE id = ?";
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->execute([$session_id, $member_id, $member_name, $session_id]);




        $conn->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Session booked successfully. Payment will be recorded when the member checks in for the scheduled session.',
            'member_id' => $member_id,
            'session_id' => $session_id,
            'payment_status' => 'not_started'
        ]);
    } catch (PDOException $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Book session error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}








if ($method === 'POST' && $action === 'terminate_session') {
    $session_id = (int) ($input['session_id'] ?? 0);
    $actor_role = strtolower(trim($input['actor_role'] ?? ''));
    $member_id = (int) ($input['member_id'] ?? 0);
    $member_email = trim($input['member_email'] ?? '');
    $admin_id = (int) ($input['admin_id'] ?? 0);
    $reason = trim($input['reason'] ?? 'Member requested session termination.');

    if ($session_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required.']);
        exit;
    }

    if (!in_array($actor_role, ['member', 'admin'], true)) {
        echo json_encode(['success' => false, 'message' => 'Only members and admins can terminate a session.']);
        exit;
    }

    try {
        if ($actor_role === 'member') {
            $member = resolveMemberId($conn, $member_id, $member_email);
            if (!$member) {
                echo json_encode(['success' => false, 'message' => 'Member account could not be verified.']);
                exit;
            }
            $member_id = (int) $member['memberID'];
        } else {
            $adminStmt = $conn->prepare(
                "SELECT adminID FROM admin_staff
                 WHERE adminID = ? AND deleted_at IS NULL
                   AND (status IS NULL OR LOWER(status) IN ('active','approved'))"
            );
            $adminStmt->execute([$admin_id]);
            $admin = $adminStmt->fetch(PDO::FETCH_ASSOC);
            $adminStmt->closeCursor();

            if (!$admin) {
                echo json_encode(['success' => false, 'message' => 'Valid admin account is required.']);
                exit;
            }
        }

        $conn->beginTransaction();

        $sessionInfo = $conn->prepare("SELECT trainer_id, session_type, start_time FROM trainer_sessions WHERE id = ?");
        $sessionInfo->execute([$session_id]);
        $sessionMeta = $sessionInfo->fetch(PDO::FETCH_ASSOC);
        $sessionInfo->closeCursor();

        $bookingSql = "SELECT TOP 1
                           mse.id AS enrollment_id,
                           mse.member_id,
                           mse.status AS enrollment_status,
                           ts.id AS session_id,
                           ts.session_type,
                           ts.start_time,
                           ts.end_time,
                           ts.is_booked,
                           ts.is_paid
                       FROM member_session_enrollments mse WITH (UPDLOCK, ROWLOCK)
                       INNER JOIN trainer_sessions ts ON ts.id = mse.session_id
                       WHERE mse.session_id = ?";
        $bookingParams = [$session_id];

        if ($actor_role === 'member') {
            $bookingSql .= " AND mse.member_id = ?";
            $bookingParams[] = $member_id;
        }

        $bookingStmt = $conn->prepare($bookingSql);
        $bookingStmt->execute($bookingParams);
        $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);
        $bookingStmt->closeCursor();

        if (!$booking) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'No active booking was found for this session.']);
            exit;
        }

        if (!in_array(strtolower((string) $booking['enrollment_status']), ['pending', 'paid'], true)) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'This booking is no longer active.']);
            exit;
        }



        $timeStmt = $conn->query("SELECT GETDATE() AS server_now");
        $serverTime = $timeStmt->fetch(PDO::FETCH_ASSOC);
        $timeStmt->closeCursor();

        if (strtotime($booking['start_time']) <= strtotime($serverTime['server_now'])) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'A session cannot be terminated after it has started.']);
            exit;
        }

        $paymentStmt = $conn->prepare(
            "SELECT TOP 1 payment_id, payment_status
             FROM payments WITH (UPDLOCK, ROWLOCK)
             WHERE member_id = ? AND session_id = ? AND payment_type = 'TRAINER_SESSION'
             ORDER BY payment_id DESC"
        );
        $paymentStmt->execute([(int) $booking['member_id'], $session_id]);
        $payment = $paymentStmt->fetch(PDO::FETCH_ASSOC);
        $paymentStmt->closeCursor();

        $paymentStatus = strtolower((string) ($payment['payment_status'] ?? ''));

        if ($paymentStatus === 'paid') {
            if ($actor_role !== 'admin') {
                $conn->rollBack();
                echo json_encode([
                    'success' => false,
                    'message' => 'This session has already been paid. It cannot be terminated automatically because payment/refund must be handled by an admin.'
                ]);
                exit;
            }

            $refundReason = $reason !== '' ? $reason : 'Session terminated by admin; refund issued.';
            $paymentId = (int) $payment['payment_id'];
            $refundStmt = $conn->prepare(
                "UPDATE payments
                 SET payment_status = 'refunded',
                     rejection_reason = ?,
                     confirmed_at = GETDATE(),
                     confirmed_by = ?
                 WHERE payment_id = ? AND payment_status = 'paid'"
            );
            $refundStmt->execute([$refundReason, $admin_id, $paymentId]);

            if ($refundStmt->rowCount() === 0) {
                $conn->rollBack();
                echo json_encode(['success' => false, 'message' => 'The payment could not be refunded.']);
                exit;
            }
        }


        $updateEnrollment = $conn->prepare(
            "UPDATE member_session_enrollments
             SET status = 'terminated'
             WHERE id = ?"
        );
        $updateEnrollment->execute([(int) $booking['enrollment_id']]);


        if ($payment && $paymentStatus === 'pending') {
            $paymentId = (int) $payment['payment_id'];
            $voidReason = $reason !== '' ? $reason : 'Booking terminated before session start.';
            $updatePayment = $conn->prepare(
                "UPDATE payments
                 SET payment_status = 'voided',
                     rejection_reason = ?
                 WHERE payment_id = ? AND payment_status = 'pending'"
            );
            $updatePayment->execute([$voidReason, $paymentId]);
        }


        $updateSession = $conn->prepare(
            "UPDATE trainer_sessions
             SET is_booked = 0,
                 is_paid = 0,
                 booked_by = NULL,
                 booked_by_name = NULL,
                 booked_at = NULL
             WHERE id = ?"
        );
        $updateSession->execute([$session_id]);

        $conn->commit();

        sendTrainerSessionNotification(
            $conn,
            (int) ($sessionMeta['trainer_id'] ?? 0),
            'Session terminated',
            "Your {$sessionMeta['session_type']} session scheduled for " . date('M j, Y g:i A', strtotime((string) ($sessionMeta['start_time'] ?? date('Y-m-d H:i:s')))) . " has been terminated. Reason: " . ($reason !== '' ? $reason : 'No reason provided.'),
            'warning'
        );

        echo json_encode([
            'success' => true,
            'message' => $paymentStatus === 'paid'
                ? 'Session terminated successfully. The paid booking was refunded and removed from revenue.'
                : 'Session terminated successfully. The trainer session is available again.',
            'session_id' => $session_id,
            'enrollment_status' => 'terminated',
            'payment_status' => $paymentStatus === 'pending' ? 'voided' : ($paymentStatus === 'paid' ? 'refunded' : ($payment['payment_status'] ?? null))
        ]);
    } catch (PDOException $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Terminate session error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}




if ($method === 'POST' && $action === 'rate_session') {
    $member_id = (int) ($input['member_id'] ?? 0);
    $member_email = trim($input['member_email'] ?? '');
    $session_id = (int) ($input['session_id'] ?? 0);
    $rating = (int) ($input['rating'] ?? 0);

    if (empty($session_id) || empty($rating)) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    if ($rating < 1 || $rating > 5) {
        echo json_encode(['success' => false, 'message' => 'Rating must be between 1 and 5']);
        exit;
    }

    try {
        ensureMemberSessionRatings($conn);
        $member = resolveMemberId($conn, $member_id, $member_email);
        if (!$member) {
            echo json_encode(['success' => false, 'message' => 'Your member account could not be verified. Please log out and log in again.']);
            exit;
        }
        $member_id = (int) $member['memberID'];


                $checkBookingSql = "SELECT mse.id
                                                        FROM member_session_enrollments mse
                                                        INNER JOIN trainer_sessions ts ON ts.id = mse.session_id
                                                        WHERE mse.member_id = ?
                                                            AND mse.session_id = ?
                                                            AND LOWER(COALESCE(mse.status, 'pending')) IN ('pending', 'paid', 'unpaid')
                                                            AND ts.status IN ('approved', 'ongoing', 'finished')";
        $checkBookingStmt = $conn->prepare($checkBookingSql);
        $checkBookingStmt->execute([$member_id, $session_id]);
        $booking = $checkBookingStmt->fetch(PDO::FETCH_ASSOC);

        if (!$booking) {
            echo json_encode(['success' => false, 'message' => 'You have not booked this session']);
            exit;
        }


        $existingRatingStmt = $conn->prepare(
            "SELECT rating FROM dbo.member_session_ratings WHERE member_id = ? AND session_id = ?"
        );
        $existingRatingStmt->execute([$member_id, $session_id]);
        if ($existingRatingStmt->fetchColumn() !== false) {
            echo json_encode(['success' => false, 'message' => 'You have already rated this session.']);
            exit;
        }



        $checkEndTimeSql = "SELECT status, end_time, GETDATE() AS server_now FROM trainer_sessions WHERE id = ?";
        $checkEndTimeStmt = $conn->prepare($checkEndTimeSql);
        $checkEndTimeStmt->execute([$session_id]);
        $sessionData = $checkEndTimeStmt->fetch(PDO::FETCH_ASSOC);

        if (!$sessionData) {
            echo json_encode(['success' => false, 'message' => 'Session not found.']);
            exit;
        }

        $normalizedSessionStatus = strtolower((string) ($sessionData['status'] ?? ''));
        $isFinishedEarly = $normalizedSessionStatus === 'finished';

        if (!$isFinishedEarly && strtotime($sessionData['end_time']) > strtotime($sessionData['server_now'])) {
            echo json_encode([
                'success' => false,
                'message' => 'Session is not yet completed. Please wait until the session ends.',
                'end_time' => $sessionData['end_time'],
                'server_now' => $sessionData['server_now']
            ]);
            exit;
        }


        $getMemberSql = "SELECT full_name FROM members WHERE memberID = ?";
        $getMemberStmt = $conn->prepare($getMemberSql);
        $getMemberStmt->execute([$member_id]);
        $member = $getMemberStmt->fetch(PDO::FETCH_ASSOC);
        $ratedByName = $member ? $member['full_name'] : null;


        $conn->beginTransaction();
        $insertRating = $conn->prepare(
            "INSERT INTO dbo.member_session_ratings (member_id, session_id, rating) VALUES (?, ?, ?)"
        );
        $insertRating->execute([$member_id, $session_id, $rating]);

        $updateAverage = $conn->prepare(
            "UPDATE dbo.trainer_sessions
             SET rating = (
                    SELECT AVG(CAST(rating AS DECIMAL(4,2)))
                    FROM dbo.member_session_ratings
                    WHERE session_id = ?
                 ),
                 rated_by = ?
             WHERE id = ?"
        );
        $updateAverage->execute([$session_id, $ratedByName, $session_id]);
        $conn->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Rating submitted successfully!',
            'member_rating' => $rating,
        ]);
    } catch (PDOException $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Rate session error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'GET' && $action === 'get_pending_sessions') {
    try {
        $sql = "SELECT ts.*, t.full_name as trainer_name, t.email as trainer_email 
                FROM trainer_sessions ts
                JOIN trainers t ON ts.trainer_id = t.trainerID
                WHERE ts.status = 'pending'
                ORDER BY ts.created_at ASC";
        $stmt = $conn->query($sql);
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'sessions' => $sessions
        ]);
    } catch (PDOException $e) {
        error_log("Get pending sessions error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'POST' && $action === 'approve_session') {
    $session_id = $input['session_id'] ?? '';
    $session_id = (int) $session_id;

    if (empty($session_id)) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required']);
        exit;
    }

    try {
        ensureSessionCatalog($conn);
        finalizePastSessions($conn);

        $sessionStmt = $conn->prepare("SELECT ts.trainer_id, ts.session_type, ts.start_time, ts.status, t.full_name AS trainer_name
                           FROM trainer_sessions ts
                           LEFT JOIN trainers t ON t.trainerID = ts.trainer_id
                           WHERE ts.id = ?");
        $sessionStmt->execute([$session_id]);
        $existingSession = $sessionStmt->fetch(PDO::FETCH_ASSOC);
        $sessionStmt->closeCursor();

        if (!$existingSession) {
            echo json_encode(['success' => false, 'message' => 'Session not found.']);
            exit;
        }

        $typeStmt = $conn->prepare("SELECT ts.session_type, gst.is_active
                                   FROM trainer_sessions ts
                                   LEFT JOIN dbo.gym_session_types gst ON gst.session_name = ts.session_type
                                   WHERE ts.id = ?");
        $typeStmt->execute([$session_id]);
        $sessionType = $typeStmt->fetch(PDO::FETCH_ASSOC);
        $typeStmt->closeCursor();

        if (!$sessionType) {
            echo json_encode(['success' => false, 'message' => 'Session not found.']);
            exit;
        }

        if (!isset($sessionType['is_active']) || (int) $sessionType['is_active'] !== 1) {
            echo json_encode(['success' => false, 'message' => 'This session type is deactivated. Activate the session type before approving this session.']);
            exit;
        }

        $sql = "UPDATE trainer_sessions SET status = 'approved' WHERE id = ? AND status = 'pending'";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$session_id]);

        if ($stmt->rowCount() > 0) {
            auditAdminActionDetail($conn, $authUser, $action, "Approved {$existingSession['session_type']} session for trainer {$existingSession['trainer_name']}");
            sendTrainerSessionNotification(
                $conn,
                (int) ($existingSession['trainer_id'] ?? 0),
                'Session approved',
                "Your {$existingSession['session_type']} session scheduled for " . date('M j, Y g:i A', strtotime((string) ($existingSession['start_time'] ?? date('Y-m-d H:i:s')))) . " has been approved.",
                'success'
            );
            echo json_encode([
                'success' => true,
                'message' => 'Session approved successfully!'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Session not found or already processed'
            ]);
        }
    } catch (PDOException $e) {
        error_log("Approve session error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'POST' && $action === 'reject_session') {
    $session_id = $input['session_id'] ?? '';
    $rejection_reason = $input['rejection_reason'] ?? '';

    if (empty($session_id)) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required']);
        exit;
    }

    try {
        $sessionStmt = $conn->prepare("SELECT ts.trainer_id, ts.session_type, ts.start_time, t.full_name AS trainer_name
                           FROM trainer_sessions ts
                           LEFT JOIN trainers t ON t.trainerID = ts.trainer_id
                           WHERE ts.id = ?");
        $sessionStmt->execute([$session_id]);
        $existingSession = $sessionStmt->fetch(PDO::FETCH_ASSOC);
        $sessionStmt->closeCursor();

        $sql = "UPDATE trainer_sessions SET status = 'rejected', admin_notes = ? WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$rejection_reason, $session_id]);

        if ($stmt->rowCount() > 0) {
            $detail = "Rejected {$existingSession['session_type']} session for trainer {$existingSession['trainer_name']}";
            if ($rejection_reason !== '') $detail .= ": {$rejection_reason}";
            auditAdminActionDetail($conn, $authUser, $action, $detail);
            sendTrainerSessionNotification(
                $conn,
                (int) ($existingSession['trainer_id'] ?? 0),
                'Session rejected',
                "Your {$existingSession['session_type']} session scheduled for " . date('M j, Y g:i A', strtotime((string) ($existingSession['start_time'] ?? date('Y-m-d H:i:s')))) . " was rejected. Reason: " . ($rejection_reason !== '' ? $rejection_reason : 'No reason provided.'),
                'error'
            );
            echo json_encode([
                'success' => true,
                'message' => 'Session rejected successfully'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Session not found or already processed'
            ]);
        }
    } catch (PDOException $e) {
        error_log("Reject session error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'GET' && $action === 'get_trainers') {
    try {
        $sql = "SELECT trainerID, full_name, email, expertise_area as specialization FROM trainers WHERE status = 'Active' AND deleted_at IS NULL";
        $stmt = $conn->query($sql);
        $trainers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'trainers' => $trainers]);
    } catch (PDOException $e) {
        error_log("Get trainers error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}


if ($method === 'GET' && $action === 'get_report_trainers') {
    try {
        $sql = "SELECT trainerID, full_name, email, phone_number, age, role, expertise_area as specialization, status, created_at
                FROM trainers
                WHERE deleted_at IS NULL
                ORDER BY full_name ASC";
        $stmt = $conn->query($sql);
        $trainers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'trainers' => $trainers]);
    } catch (PDOException $e) {
        error_log("Get report trainers error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}




if ($method === 'POST' && $action === 'delete_session') {
    $session_id = $input['session_id'] ?? '';

    if (empty($session_id)) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required']);
        exit;
    }

    try {
        $ownershipSql = "SELECT trainer_id FROM trainer_sessions WHERE id = ?";
        $ownershipStmt = $conn->prepare($ownershipSql);
        $ownershipStmt->execute([$session_id]);
        $sessionOwner = $ownershipStmt->fetchColumn();
        if (strtolower((string) ($authUser['role'] ?? '')) === 'trainer' && (int) $sessionOwner !== (int) $authUser['sub']) {
            authError('You can only delete your own sessions.');
        }

        $checkSql = "SELECT id FROM trainer_sessions WHERE id = ? AND start_time > GETDATE() AND status = 'pending'";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->execute([$session_id]);
        $sessionExists = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$sessionExists) {
            echo json_encode(['success' => false, 'message' => 'Cannot delete approved sessions or past sessions']);
            exit;
        }

        $sql = "DELETE FROM trainer_sessions WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$session_id]);

        echo json_encode(['success' => true, 'message' => 'Session deleted successfully']);
    } catch (PDOException $e) {
        error_log("Delete session error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'GET' && $action === 'get_session_booked_members') {
    $session_id = isset($_GET['session_id']) ? (int) $_GET['session_id'] : 0;

    if (empty($session_id)) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required']);
        exit;
    }

    try {
        $ownerStmt = $conn->prepare("SELECT trainer_id FROM trainer_sessions WHERE id = ?");
        $ownerStmt->execute([$session_id]);
        $sessionOwner = $ownerStmt->fetchColumn();
        if (!$sessionOwner) {
            echo json_encode(['success' => false, 'message' => 'Session not found.']);
            exit;
        }
        if (strtolower((string) ($authUser['role'] ?? '')) === 'trainer' && (int) $sessionOwner !== (int) $authUser['sub']) {
            authError('You can only view members booked into your own sessions.');
        }

        $sql = "SELECT m.memberID, m.full_name, m.email, m.phone
                FROM member_session_enrollments mse
                JOIN members m ON mse.member_id = m.memberID
                WHERE mse.session_id = ?
                  AND mse.status IN ('pending', 'paid')
                ORDER BY mse.booking_date ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$session_id]);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'session_id' => $session_id,
            'members' => $members,
            'total' => count($members)
        ]);
    } catch (PDOException $e) {
        error_log("Get session booked members error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'GET' && $action === 'get_session_bookings') {
    $session_id = isset($_GET['session_id']) ? $_GET['session_id'] : '';

    if (empty($session_id)) {
        echo json_encode(['success' => false, 'message' => 'Session ID is required']);
        exit;
    }

    try {
        if (strtolower((string) ($authUser['role'] ?? '')) === 'trainer') {
            $ownerStmt = $conn->prepare("SELECT trainer_id FROM trainer_sessions WHERE id = ?");
            $ownerStmt->execute([(int) $session_id]);
            if ((int) $ownerStmt->fetchColumn() !== (int) $authUser['sub']) {
                authError('You can only view bookings for your own sessions.');
            }
        }

        $tableCheck = $conn->query("SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'member_session_enrollments'");
        $tableExists = $tableCheck->fetch(PDO::FETCH_ASSOC);

        if ($tableExists['count'] == 0) {
            echo json_encode(['success' => true, 'count' => 0]);
            exit;
        }

        $sql = "SELECT COUNT(*) as count FROM member_session_enrollments WHERE session_id = ? AND status IN ('pending','paid')";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$session_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'count' => $result['count'] ?? 0
        ]);
    } catch (PDOException $e) {
        error_log("Get bookings error: " . $e->getMessage());
        echo json_encode([
            'success' => true,
            'count' => 0
        ]);
    }
    exit;
}




if ($method === 'POST' && $action === 'update_session') {
    $session_id = $input['session_id'] ?? '';
    $trainer_id = $input['trainer_id'] ?? '';
    $session_type = $input['session_type'] ?? '';
    $start_time = $input['start_time'] ?? '';
    $end_time = $input['end_time'] ?? '';

    if (empty($session_id) || empty($trainer_id) || empty($start_time) || empty($end_time)) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    try {
        ensureSessionCatalog($conn);
        ensureTrainerSessionColumns($conn);

        if (strtotime((string) $start_time) <= time() || strtotime((string) $end_time) <= time()) {
            echo json_encode(['success' => false, 'message' => 'The selected time/date has already passed. Please create another session.']);
            exit;
        }

        if (strtotime((string) $end_time) <= strtotime((string) $start_time)) {
            echo json_encode(['success' => false, 'message' => 'End time must be after start time.']);
            exit;
        }

        $priceStmt = $conn->prepare(
            "SELECT TOP 1 price
             FROM dbo.gym_session_types
             WHERE session_name = ?
               AND is_active = 1"
        );
        $priceStmt->execute([$session_type]);
        $catalog = $priceStmt->fetch(PDO::FETCH_ASSOC);
        $priceStmt->closeCursor();

        if (!$catalog) {
            echo json_encode([
                'success' => false,
                'message' => 'Session type is not available or has been deactivated.'
            ]);
            exit;
        }

        $price = (float) $catalog['price'];

        $max_participants = normalizeMaxParticipants($input['max_participants'] ?? ($input['maxParticipants'] ?? 1));
        if ($max_participants < 1) {
            echo json_encode(['success' => false, 'message' => 'Max participants must be at least 1']);
            exit;
        }

        $sql = "UPDATE trainer_sessions
                SET session_type = ?, start_time = ?, end_time = ?, price = ?, max_participants = ?
                WHERE id = ? AND trainer_id = ? AND status IN ('pending', 'approved') AND start_time > GETDATE()";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$session_type, $start_time, $end_time, $price, $max_participants, $session_id, $trainer_id]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Session updated successfully']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Unable to update session']);
        }
    } catch (PDOException $e) {
        error_log("Update session error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'GET' && $action === 'get_all_sessions') {
    try {
        ensureTrainerSessionColumns($conn);
        $sql = "SELECT ts.*, t.full_name as trainer_name,
                       (SELECT COUNT(*) FROM member_session_enrollments mse WHERE mse.session_id = ts.id AND mse.status IN ('pending','paid')) AS booking_count
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




if ($method === 'GET' && $action === 'test') {
    echo json_encode([
        'success' => true,
        'message' => 'API is working',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}



echo json_encode(['success' => false, 'message' => 'Invalid action: ' . $action]);
