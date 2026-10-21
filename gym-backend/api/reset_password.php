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
$resetToken = trim($input['resetToken'] ?? '');
$newPassword = $input['newPassword'] ?? '';

$validPassword = strlen($newPassword) >= 8
    && preg_match('/[A-Z]/', $newPassword)
    && preg_match('/[a-z]/', $newPassword)
    && preg_match('/\d/', $newPassword)
    && preg_match('/[^A-Za-z0-9]/', $newPassword);

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^[a-f0-9]{64}$/i', $resetToken)) {
    echo json_encode(['success' => false, 'message' => 'Invalid password reset request.']);
    exit;
}

if (!$validPassword) {
    echo json_encode([
        'success' => false,
        'message' => 'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character.'
    ]);
    exit;
}

try {
    $conn = getConnection();
    ensurePasswordResetAccountColumns($conn);
    $tokenHash = hash('sha256', $resetToken);

    $stmt = $conn->prepare(
        "SELECT TOP 1 id, account_id, account_role
         FROM password_reset_otps
         WHERE LOWER(email) = LOWER(?)
           AND reset_token_hash = ?
           AND verified_at IS NOT NULL
           AND used_at IS NULL
           AND reset_expires_at > GETDATE()
         ORDER BY verified_at DESC, id DESC"
    );
    $stmt->execute([$email, $tokenHash]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$record) {
        echo json_encode(['success' => false, 'message' => 'Your password reset session is invalid or expired. Please start again.']);
        exit;
    }

    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

    $conn->beginTransaction();

    if (!updatePasswordResetAccount($conn, (string) $record['account_role'], (int) $record['account_id'], $hashedPassword)) {
        $conn->rollBack();
        echo json_encode(['success' => false, 'message' => 'Unable to update the account password.']);
        exit;
    }

    
    $consume = $conn->prepare(
        "UPDATE password_reset_otps
         SET used_at = GETDATE()
            WHERE account_id = ? AND account_role = ? AND used_at IS NULL"
    );
        $consume->execute([$record['account_id'], $record['account_role']]);

    $conn->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Password changed successfully. You can now log in with your new password.'
    ]);
} catch (Throwable $e) {
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log('Reset password error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Unable to change the password right now.']);
}
