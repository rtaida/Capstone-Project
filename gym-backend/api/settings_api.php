<?php
require_once __DIR__.'/config/auth.php';
require_once __DIR__.'/config/audit.php';
$authUser = null;
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'OPTIONS') $authUser = requireRole(['admin','staff']);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }

function getConnection() {
    try {
        $conn = new PDO(
            "odbc:Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=GymDB;Trusted_Connection=yes;TrustServerCertificate=yes;"
        );
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $conn;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
        exit;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $conn = getConnection();
    if ($authUser) auditAdminAction($conn, $authUser, $action);
    
    
    
    
    if ($method === 'GET' && ($action === 'get' || $action === '')) {
        $sql = "SELECT TOP 1 * FROM gym_settings ORDER BY id DESC";
        $stmt = $conn->query($sql);
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'settings' => $settings
        ]);
        exit;
    }
    
    
    
    
    if ($method === 'POST' && $action === 'update') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $gym_name = $input['gym_name'] ?? 'Capra Fitness';
        $gym_address = $input['gym_address'] ?? '';
        $gym_phone = $input['gym_phone'] ?? '';
        $gym_email = $input['gym_email'] ?? '';
        $gym_website = $input['gym_website'] ?? '';
        $logo_url = $input['logo_url'] ?? null;
        $primary_color = $input['primary_color'] ?? '#D9A75B';
        $secondary_color = $input['secondary_color'] ?? '#0A0A0A';
        $accent_color = $input['accent_color'] ?? '#F5E6B3';
        $text_color = $input['text_color'] ?? '#FFFFFF';
        $background_color = $input['background_color'] ?? '#0A0A0A';
        
        
        $checkSql = "SELECT COUNT(*) as count FROM gym_settings";
        $checkStmt = $conn->query($checkSql);
        $count = $checkStmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        if ($count > 0) {
            
            $sql = "UPDATE gym_settings SET 
                    gym_name = ?, 
                    gym_address = ?, 
                    gym_phone = ?, 
                    gym_email = ?, 
                    gym_website = ?, 
                    logo_url = ?,
                    primary_color = ?,
                    secondary_color = ?,
                    accent_color = ?,
                    text_color = ?,
                    background_color = ?,
                    updated_at = GETDATE()
                    WHERE id = (SELECT TOP 1 id FROM gym_settings ORDER BY id DESC)";
            $stmt = $conn->prepare($sql);
            $stmt->execute([$gym_name, $gym_address, $gym_phone, $gym_email, $gym_website, $logo_url, $primary_color, $secondary_color, $accent_color, $text_color, $background_color]);
        } else {
            
            $sql = "INSERT INTO gym_settings (gym_name, gym_address, gym_phone, gym_email, gym_website, logo_url, primary_color, secondary_color, accent_color, text_color, background_color) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $conn->prepare($sql);
            $stmt->execute([$gym_name, $gym_address, $gym_phone, $gym_email, $gym_website, $logo_url, $primary_color, $secondary_color, $accent_color, $text_color, $background_color]);
        }
        
        
        $getSql = "SELECT TOP 1 * FROM gym_settings ORDER BY id DESC";
        $getStmt = $conn->query($getSql);
        $settings = $getStmt->fetch(PDO::FETCH_ASSOC);
        if ($authUser) auditAdminActionDetail($conn, $authUser, $action, 'updated gym settings');
        
        echo json_encode([
            'success' => true,
            'message' => 'Settings saved successfully',
            'settings' => $settings
        ]);
        exit;
    }
    
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
    
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>