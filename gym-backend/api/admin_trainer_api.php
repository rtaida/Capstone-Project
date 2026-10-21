<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function resolvePublicOrigin(): array {
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

function buildAppBaseUrl(string $path = ''): string {
    $result = '/' . ltrim((string) $path, '/');
    $result = preg_replace('#^/(?:Capstone%20Project|Capstone Project)/gym-backend#i', '', $result);
    return $result === '' ? '/' : $result;
}

function normalizeAssetUrl(?string $value): ?string {
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

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');

function getConnection()
{
    try {
        $conn = new PDO(
            "odbc:Driver={ODBC Driver 18 for SQL Server};Server=localhost\SQLEXPRESS;Database=GymDB;Trusted_Connection=yes;TrustServerCertificate=yes;"
        );
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $conn;
    } catch (PDOException $e) {
        error_log("Database connection failed: " . $e->getMessage());
        return null;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';
require_once __DIR__ . '/config/auth.php';
require_once __DIR__ . '/config/audit.php';

$conn = getConnection();

if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}
$authUser = requireRole(['admin', 'staff']);
auditAdminAction($conn, $authUser, $action);
ensureAdminPresenceColumns($conn);
ensureProfilePhotoColumns($conn);

function validPhilippineMobile(string $phone): bool
{
    return (bool) preg_match('/^09\d{9}$/', trim($phone));
}

function normalizeAdminRole(string $role): ?string
{
    $normalized = strtolower(trim($role));
    return match ($normalized) {
        'super admin', 'superadmin' => 'Super Admin',
        'admin' => 'Admin',
        'staff' => 'Staff',
        default => null,
    };
}

function ensureProfilePhotoColumns(PDO $conn): void
{
    foreach (['admin_staff', 'trainers'] as $table) {
        if (!$conn->query("SELECT COL_LENGTH('dbo.$table', 'profile_photo')")->fetchColumn()) {
            $conn->exec("ALTER TABLE dbo.$table ADD profile_photo NVARCHAR(500) NULL");
        }
    }
}

function saveProfilePhoto(string $dataUrl, string $prefix, int $id): ?string
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
    $fileName = $prefix . '_' . $id . '_' . time() . '.' . $extension;
    file_put_contents($directory . $fileName, $image);
    return buildAppBaseUrl('profile_uploads/' . $fileName);
}




if ($method === 'GET' && $action === 'get_all') {
    try {

        $adminSql = "SELECT adminID as id, full_name, email, phone_number as phone, age, role, status, profile_photo, created_at, updated_at, last_login, last_seen,
                            CASE WHEN LOWER(ISNULL(status,'active')) IN ('active','approved')
                                      AND last_seen IS NOT NULL
                                      AND last_seen >= DATEADD(MINUTE, -2, GETDATE())
                                 THEN 1 ELSE 0 END AS is_online
                     FROM admin_staff
                     WHERE deleted_at IS NULL
                     ORDER BY created_at DESC";
        $adminStmt = $conn->query($adminSql);
        $admins = array_map(function ($row) {
            if (isset($row['profile_photo'])) {
                $row['profile_photo'] = normalizeAssetUrl($row['profile_photo']);
            }
            return $row;
        }, $adminStmt->fetchAll(PDO::FETCH_ASSOC));


        $trainerSql = "SELECT trainerID as id, full_name, email, phone_number as phone, age, role, expertise_area, status, profile_photo, created_at, updated_at 
                       FROM trainers 
                       WHERE deleted_at IS NULL OR deleted_at = ''
                       ORDER BY created_at DESC";
        $trainerStmt = $conn->query($trainerSql);
        $trainers = array_map(function ($row) {
            if (isset($row['profile_photo'])) {
                $row['profile_photo'] = normalizeAssetUrl($row['profile_photo']);
            }
            return $row;
        }, $trainerStmt->fetchAll(PDO::FETCH_ASSOC));

        echo json_encode([
            'success' => true,
            'admins' => $admins,
            'trainers' => $trainers
        ]);
    } catch (PDOException $e) {
        error_log("Get all error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}




if ($method === 'POST' && $action === 'add_admin') {
    $full_name = $input['full_name'] ?? '';
    $email = $input['email'] ?? '';
    $phone = $input['phone'] ?? '';
    $age = $input['age'] ?? null;
    $role = normalizeAdminRole((string) ($input['role'] ?? 'Admin'));
    $status = $input['status'] ?? 'Active';
    $password = $input['password'] ?? '';

    if (empty($full_name) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Full name, email, and password are required']);
        exit;
    }
    if ($role === null) {
        echo json_encode(['success' => false, 'message' => 'Invalid administrator role.']);
        exit;
    }
    if (!validPhilippineMobile($phone)) {
        echo json_encode(['success' => false, 'message' => 'Enter a valid Philippine mobile number (09XXXXXXXXX)']);
        exit;
    }

    try {
        $checkSql = "SELECT email FROM admin_staff WHERE email = ?";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->execute([$email]);
        if ($checkStmt->fetch()) {
            echo json_encode(['success' => false, 'message' => 'Email already exists']);
            exit;
        }


        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $sql = "INSERT INTO admin_staff (full_name, email, phone_number, age, role, status, password, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$full_name, $email, $phone, $age, $role, $status, $hashedPassword]);

        auditAdminActionDetail($conn, $authUser, $action, "added admin {$full_name}");
        echo json_encode(['success' => true, 'message' => 'Admin added successfully']);
    } catch (PDOException $e) {
        error_log("Add admin error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}




if ($method === 'POST' && $action === 'add_trainer') {
    $full_name = $input['full_name'] ?? '';
    $email = $input['email'] ?? '';
    $phone = $input['phone'] ?? '';
    $age = $input['age'] ?? null;
    $role = $input['role'] ?? 'Trainer';
    $status = $input['status'] ?? 'Active';
    $expertise_area = $input['expertise_area'] ?? '';
    $password = $input['password'] ?? '';

    if (empty($full_name) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Full name, email, and password are required']);
        exit;
    }
    if (!validPhilippineMobile($phone)) {
        echo json_encode(['success' => false, 'message' => 'Enter a valid Philippine mobile number (09XXXXXXXXX)']);
        exit;
    }

    try {
        $checkSql = "SELECT email FROM trainers WHERE email = ?";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->execute([$email]);
        if ($checkStmt->fetch()) {
            echo json_encode(['success' => false, 'message' => 'Email already exists']);
            exit;
        }

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $sql = "INSERT INTO trainers (full_name, email, phone_number, age, role, expertise_area, status, password, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$full_name, $email, $phone, $age, $role, $expertise_area, $status, $hashedPassword]);

        auditAdminActionDetail($conn, $authUser, $action, "added trainer {$full_name}");
        echo json_encode(['success' => true, 'message' => 'Trainer added successfully']);
    } catch (PDOException $e) {
        error_log("Add trainer error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}




if ($method === 'POST' && $action === 'update_admin') {
    $id = $input['id'] ?? '';
    $full_name = $input['full_name'] ?? '';
    $email = $input['email'] ?? '';
    $phone = $input['phone'] ?? '';
    $age = $input['age'] ?? null;
    $role = normalizeAdminRole((string) ($input['role'] ?? 'Admin'));
    $status = $input['status'] ?? 'Active';
    $password = $input['password'] ?? '';
    $profile_photo = saveProfilePhoto(trim((string) ($input['profile_photo'] ?? '')), 'admin', (int) $id);

    if (empty($id) || empty($full_name) || empty($email)) {
        echo json_encode(['success' => false, 'message' => 'ID, full name, and email are required']);
        exit;
    }
    if ($role === null) {
        echo json_encode(['success' => false, 'message' => 'Invalid administrator role.']);
        exit;
    }
    if (!validPhilippineMobile($phone)) {
        echo json_encode(['success' => false, 'message' => 'Enter a valid Philippine mobile number (09XXXXXXXXX)']);
        exit;
    }

    try {
        if ((int) $id !== (int) ($authUser['sub'] ?? 0)) {
            echo json_encode(['success' => false, 'message' => 'You can only edit your own administrator account.']);
            exit;
        }
        $beforeStmt = $conn->prepare('SELECT full_name, email, phone_number, age, role, status, profile_photo FROM admin_staff WHERE adminID = ?');
        $beforeStmt->execute([$id]);
        $before = $beforeStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        if ($profile_photo !== null) {
            $sql = "UPDATE admin_staff SET full_name = ?, email = ?, phone_number = ?, age = ?, role = ?, status = ?, profile_photo = ?" . (!empty($password) ? ", password = ?" : "") . ", updated_at = GETDATE() WHERE adminID = ?";
            $params = [$full_name, $email, $phone, $age, $role, $status, $profile_photo];
            if (!empty($password)) $params[] = password_hash($password, PASSWORD_DEFAULT);
            $params[] = $id;
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
        } elseif (!empty($password)) {
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
                $sql = "UPDATE admin_staff SET full_name = ?, email = ?, phone_number = ?, age = ?, role = ?, status = ?, password = ?, updated_at = GETDATE() 
                    WHERE adminID = ?";
            $stmt = $conn->prepare($sql);
                $stmt->execute([$full_name, $email, $phone, $age, $role, $status, $hashedPassword, $id]);
        } else {
                $sql = "UPDATE admin_staff SET full_name = ?, email = ?, phone_number = ?, age = ?, role = ?, status = ?, updated_at = GETDATE() 
                    WHERE adminID = ?";
            $stmt = $conn->prepare($sql);
                $stmt->execute([$full_name, $email, $phone, $age, $role, $status, $id]);
        }

        $changed = auditChangedFields($before, [
            'full_name' => $full_name, 'email' => $email, 'phone_number' => $phone,
            'age' => $age, 'role' => $role, 'status' => $status, 'profile_photo' => $profile_photo,
        ], [
            'full_name' => 'full name', 'email' => 'email', 'phone_number' => 'phone number',
            'age' => 'age', 'role' => 'role', 'status' => 'status', 'profile_photo' => 'profile photo',
        ]);
        if (!empty($password)) $changed[] = 'password';
        auditAdminActionDetail($conn, $authUser, $action, "updated admin {$full_name}" . ($changed ? ': changed ' . implode(', ', $changed) : ''));
        echo json_encode(['success' => true, 'message' => 'Admin updated successfully']);
    } catch (PDOException $e) {
        error_log("Update admin error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}




if ($method === 'POST' && $action === 'update_trainer') {
    $id = $input['id'] ?? '';
    $full_name = $input['full_name'] ?? '';
    $email = $input['email'] ?? '';
    $phone = $input['phone'] ?? '';
    $age = $input['age'] ?? null;
    $role = $input['role'] ?? 'Trainer';
    $status = $input['status'] ?? 'Active';
    $expertise_area = $input['expertise_area'] ?? '';
    $password = $input['password'] ?? '';
    $profile_photo = saveProfilePhoto(trim((string) ($input['profile_photo'] ?? '')), 'trainer', (int) $id);

    if (empty($id) || empty($full_name) || empty($email)) {
        echo json_encode(['success' => false, 'message' => 'ID, full name, and email are required']);
        exit;
    }
    if (!validPhilippineMobile($phone)) {
        echo json_encode(['success' => false, 'message' => 'Enter a valid Philippine mobile number (09XXXXXXXXX)']);
        exit;
    }

    try {
        $beforeStmt = $conn->prepare('SELECT full_name, email, phone_number, age, role, expertise_area, status, profile_photo FROM trainers WHERE trainerID = ?');
        $beforeStmt->execute([$id]);
        $before = $beforeStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        if ($profile_photo !== null) {
            $sql = "UPDATE trainers SET full_name = ?, email = ?, phone_number = ?, age = ?, role = ?, expertise_area = ?, status = ?, profile_photo = ?" . (!empty($password) ? ", password = ?" : "") . ", updated_at = GETDATE() WHERE trainerID = ?";
            $params = [$full_name, $email, $phone, $age, $role, $expertise_area, $status, $profile_photo];
            if (!empty($password)) $params[] = password_hash($password, PASSWORD_DEFAULT);
            $params[] = $id;
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
        } elseif (!empty($password)) {
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $sql = "UPDATE trainers SET full_name = ?, email = ?, phone_number = ?, age = ?, role = ?, expertise_area = ?, status = ?, password = ?, updated_at = GETDATE() 
                    WHERE trainerID = ?";
            $stmt = $conn->prepare($sql);
            $stmt->execute([$full_name, $email, $phone, $age, $role, $expertise_area, $status, $hashedPassword, $id]);
        } else {
            $sql = "UPDATE trainers SET full_name = ?, email = ?, phone_number = ?, age = ?, role = ?, expertise_area = ?, status = ?, updated_at = GETDATE() 
                    WHERE trainerID = ?";
            $stmt = $conn->prepare($sql);
            $stmt->execute([$full_name, $email, $phone, $age, $role, $expertise_area, $status, $id]);
        }

        $changed = auditChangedFields($before, [
            'full_name' => $full_name, 'email' => $email, 'phone_number' => $phone,
            'age' => $age, 'role' => $role, 'expertise_area' => $expertise_area,
            'status' => $status, 'profile_photo' => $profile_photo,
        ], [
            'full_name' => 'full name', 'email' => 'email', 'phone_number' => 'phone number',
            'age' => 'age', 'role' => 'role', 'expertise_area' => 'expertise area',
            'status' => 'status', 'profile_photo' => 'profile photo',
        ]);
        if (!empty($password)) $changed[] = 'password';
        auditAdminActionDetail($conn, $authUser, $action, "updated trainer {$full_name}" . ($changed ? ': changed ' . implode(', ', $changed) : ''));
        echo json_encode(['success' => true, 'message' => 'Trainer updated successfully']);
    } catch (PDOException $e) {
        error_log("Update trainer error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}




if ($method === 'POST' && $action === 'delete_admin') {
    $id = $input['id'] ?? '';

    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID is required']);
        exit;
    }

    try {
        if ((int) $id !== (int) ($authUser['sub'] ?? 0)) {
            echo json_encode(['success' => false, 'message' => 'You cannot delete another administrator account.']);
            exit;
        }
        $nameStmt = $conn->prepare('SELECT full_name FROM admin_staff WHERE adminID = ?');
        $nameStmt->execute([$id]);
        $adminName = (string) $nameStmt->fetchColumn();
        $sql = "UPDATE admin_staff SET deleted_at = GETDATE() WHERE adminID = ?";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$id]);

        auditAdminActionDetail($conn, $authUser, $action, "deleted admin {$adminName}");
        echo json_encode(['success' => true, 'message' => 'Admin deleted successfully']);
    } catch (PDOException $e) {
        error_log("Delete admin error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}




if ($method === 'POST' && $action === 'delete_trainer') {
    $id = $input['id'] ?? '';

    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID is required']);
        exit;
    }

    try {
        $sql = "UPDATE trainers SET deleted_at = GETDATE() WHERE trainerID = ?";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$id]);

        $nameStmt = $conn->prepare('SELECT full_name FROM trainers WHERE trainerID = ?');
        $nameStmt->execute([$id]);
        auditAdminActionDetail($conn, $authUser, $action, 'deleted trainer ' . (string)$nameStmt->fetchColumn());
        echo json_encode(['success' => true, 'message' => 'Trainer deleted successfully']);
    } catch (PDOException $e) {
        error_log("Delete trainer error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}


if ($method === 'POST' && $action === 'heartbeat') {
    try {
        $id = (int) ($authUser['sub'] ?? 0);
        $stmt = $conn->prepare("UPDATE admin_staff SET last_seen = GETDATE() WHERE adminID = ? AND deleted_at IS NULL");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        error_log("Admin heartbeat error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Unable to update online status']);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);