<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');

require_once __DIR__ . '/config/password_reset.php';

function getConnection(): PDO
{
    $conn = new PDO(
        "odbc:Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=GymDB;Trusted_Connection=yes;TrustServerCertificate=yes;"
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $conn;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$email = strtolower(trim($input['email'] ?? ''));
$otp = trim($input['otp'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $otp)) {
    echo json_encode(['success' => false, 'message' => 'Enter the 6-digit verification code.']);
    exit;
}

try {
    $conn = getConnection();
    ensurePasswordResetAccountColumns($conn);

    $stmt = $conn->prepare(
        "SELECT TOP 1 id, account_id, account_role, otp_hash, expires_at, attempts
         FROM password_reset_otps
         WHERE LOWER(email) = LOWER(?)
           AND used_at IS NULL
           AND verified_at IS NULL
         ORDER BY created_at DESC, id DESC"
    );
    $stmt->execute([$email]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$record) {
        echo json_encode(['success' => false, 'message' => 'This verification code is invalid or has expired.']);
        exit;
    }

    if ((int) $record['attempts'] >= 5) {
        echo json_encode(['success' => false, 'message' => 'Too many incorrect attempts. Please request a new code.']);
        exit;
    }

    if (strtotime($record['expires_at']) < time()) {
        echo json_encode(['success' => false, 'message' => 'This verification code has expired. Please request a new one.']);
        exit;
    }

    if (!password_verify($otp, $record['otp_hash'])) {
        $attempt = $conn->prepare("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?");
        $attempt->execute([$record['id']]);
        echo json_encode(['success' => false, 'message' => 'Incorrect verification code.']);
        exit;
    }

    $resetToken = bin2hex(random_bytes(32));
    $resetTokenHash = hash('sha256', $resetToken);

    $update = $conn->prepare(
        "UPDATE password_reset_otps
         SET verified_at = GETDATE(), reset_token_hash = ?, reset_expires_at = DATEADD(MINUTE, 10, GETDATE())
         WHERE id = ?"
    );
    $update->execute([$resetTokenHash, $record['id']]);

    echo json_encode([
        'success' => true,
        'message' => 'Code verified successfully.',
        'resetToken' => $resetToken
    ]);
} catch (Throwable $e) {
    error_log('Verify password reset OTP error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Unable to verify the code right now.']);
}
