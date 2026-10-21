<?php




$allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://192.168.100.154:5173',
    'https://192.168.100.154:5173',
    'https://localhost:5173',
    'https://127.0.0.1:5173',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && (in_array($origin, $allowedOrigins, true) || preg_match('/^https?:\/\/((localhost)|(127\.0\.0\.1)|(?:192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])))/', $origin))) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
} elseif ($origin === '') {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}




error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');




require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/config/member_identity.php';

function getConnection(): ?PDO
{
    try {
        return capraDb();
    } catch (PDOException $e) {
        error_log("Database connection failed: " . $e->getMessage());
        return null;
    }
}



$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);


if ($method !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$conn = getConnection();

if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

$conn->exec('SET NOCOUNT ON');
ensureMemberIdentitySchema($conn);


$nameParts = memberNamePartsFromInput(is_array($input) ? $input : []);
[$firstName, $lastName, $middleInitial] = $nameParts;
$fullName = buildMemberFullName($firstName, $lastName, $middleInitial);
$email = $input['email'] ?? '';
$phone = $input['phone'] ?? '';
$weight = $input['weight'] ?? null;
$height = $input['height'] ?? null;
$dateOfBirth = trim((string) ($input['date_of_birth'] ?? ''));
$birthDate = DateTime::createFromFormat('!Y-m-d', $dateOfBirth);
$birthDateErrors = DateTime::getLastErrors();
$birthDateIsValid = $birthDate && (!$birthDateErrors || ($birthDateErrors['warning_count'] === 0 && $birthDateErrors['error_count'] === 0)) && $birthDate->format('Y-m-d') === $dateOfBirth;
$age = $birthDateIsValid ? $birthDate->diff(new DateTime('today'))->y : null;
$gender = $input['gender'] ?? 'Male';
$paymentMethod = 'Cash';
$password = $input['password'] ?? '';
$role = 'member';


if ($firstName === '' || $lastName === '' || empty($email) || empty($phone) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'First name, last name, email, contact number, and password are required']);
    exit;
}

$nameError = memberNamePartsValidationMessage($firstName, $lastName, $middleInitial);
if ($nameError !== null) {
    echo json_encode(['success' => false, 'message' => $nameError]);
    exit;
}


if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address']);
    exit;
}

if (!preg_match('/^09\d{9}$/', $phone)) {
    echo json_encode(['success' => false, 'message' => 'Invalid contact number. Use an 11-digit Philippine mobile number starting with 09.']);
    exit;
}

if (!in_array($gender, ['Male', 'Female'], true)) {
    echo json_encode(['success' => false, 'message' => 'Invalid gender selection']);
    exit;
}

if (!$birthDateIsValid || $age < 12 || $age > 120) {
    echo json_encode(['success' => false, 'message' => 'Enter a valid birthdate for an age between 12 and 120']);
    exit;
}

try {

    $duplicateMessage = memberIdentityDuplicateMessage($conn, $email, $firstName, $lastName, $middleInitial);
    if ($duplicateMessage !== null) {
        echo json_encode(['success' => false, 'message' => $duplicateMessage]);
        exit;
    }


    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);


            $sql = "INSERT INTO members (full_name, first_name, last_name, middle_initial, email, phone, weight, height, age, date_of_birth, gender, payment_method, password, status, approval_status, role, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'member', GETDATE())";
    $stmt = $conn->prepare($sql);
            $stmt->execute([$fullName, $firstName, $lastName, $middleInitial, $email, $phone, $weight, $height, $age, $dateOfBirth, $gender, $paymentMethod, $hashedPassword]);

    echo json_encode([
        'success' => true,
        'message' => 'Account created successfully! Waiting for admin approval.',
        'status' => 'pending'
    ]);
} catch (PDOException $e) {
    error_log("Registration error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
exit;
?>