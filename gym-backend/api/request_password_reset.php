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

require_once __DIR__ . '/config/email_config.php';
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



$genericResponse = [
    'success' => true,
    'message' => 'If an account exists for that email, a verification code has been sent.'
];

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode($genericResponse);
    exit;
}

try {
    $conn = getConnection();

    ensurePasswordResetAccountColumns($conn);
    $account = findPasswordResetAccount($conn, $email);

    if (!$account) {
        echo json_encode($genericResponse);
        exit;
    }

    $recentRequest = $conn->prepare(
        "SELECT COUNT(*) FROM password_reset_otps
         WHERE account_id = ? AND account_role = ?
           AND created_at >= DATEADD(MINUTE, -1, GETDATE())"
    );
    $recentRequest->execute([$account['account_id'], $account['account_role']]);
    if ((int) $recentRequest->fetchColumn() > 0) {
        echo json_encode($genericResponse);
        exit;
    }

    
    $invalidate = $conn->prepare(
        "UPDATE password_reset_otps
         SET used_at = GETDATE()
            WHERE account_id = ? AND account_role = ? AND used_at IS NULL"
    );
        $invalidate->execute([$account['account_id'], $account['account_role']]);

    $otp = (string) random_int(100000, 999999);
    $otpHash = password_hash($otp, PASSWORD_DEFAULT);

    $insert = $conn->prepare(
        "INSERT INTO password_reset_otps
            (memberID, account_id, account_role, email, otp_hash, expires_at, attempts, created_at)
         VALUES (?, ?, ?, ?, ?, DATEADD(MINUTE, 5, GETDATE()), 0, GETDATE())"
    );
    $memberId = $account['account_role'] === 'member' ? $account['account_id'] : null;
    $insert->execute([$memberId, $account['account_id'], $account['account_role'], $account['email'], $otpHash]);

    if (!sendPasswordResetOtpEmail($account['email'], $otp)) {
        
        $cleanup = $conn->prepare(
            "UPDATE password_reset_otps
             SET used_at = GETDATE()
               WHERE account_id = ? AND account_role = ? AND otp_hash = ? AND used_at IS NULL"
        );
           $cleanup->execute([$account['account_id'], $account['account_role'], $otpHash]);

        throw new RuntimeException('Password reset email could not be sent.');
    }

    echo json_encode($genericResponse);
} catch (Throwable $e) {
    error_log('Request password reset error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'We could not send the verification email right now. Please try again later.'
    ]);
}
