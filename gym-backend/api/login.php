<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
if ($_SERVER['REQUEST_METHOD']==='OPTIONS') { http_response_code(204); exit; }
error_reporting(E_ALL); ini_set('display_errors','0'); ini_set('log_errors','1'); ini_set('error_log',__DIR__.'/error_log.txt');
require_once __DIR__.'/config/db.php';
require_once __DIR__.'/config/auth.php';
require_once __DIR__.'/config/audit.php';

$input=json_decode(file_get_contents('php://input'),true) ?: [];
$email=trim((string)($input['email']??'')); $password=(string)($input['password']??'');
if (!filter_var($email,FILTER_VALIDATE_EMAIL)||$password==='') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Valid email and password are required']); exit; }

function verifyAndUpgrade(string $plain, string $stored): bool {
    if ($stored!=='' && password_verify($plain,$stored)) return true;
    // Legacy accounts may still contain plaintext passwords. Upgrade them immediately after a successful legacy login.
    return $stored !== '' && !str_starts_with($stored,'$2y$') && !str_starts_with($stored,'$argon2') && hash_equals($stored,$plain);
}
function upgradedHash(string $plain,string $stored): ?string {
    if ($stored!=='' && (str_starts_with($stored,'$2y$')||str_starts_with($stored,'$argon2'))) return null;
    return password_hash($plain,PASSWORD_DEFAULT);
}

function loginRateKey(string $email): string {
    return hash('sha256', strtolower($email));
}

function checkLoginRateLimit(PDO $db, string $rateKey): int {
    $st = $db->prepare('SELECT attempts, DATEDIFF(SECOND, window_started, SYSUTCDATETIME()) AS elapsed FROM dbo.login_rate_limits WHERE rate_key=?');
    $st->execute([$rateKey]);
    $row = $st->fetch();
    if (!$row) return 0;
    $elapsed = (int)$row['elapsed'];
    if ($elapsed >= 240) {
        $db->prepare('DELETE FROM dbo.login_rate_limits WHERE rate_key=?')->execute([$rateKey]);
        return 0;
    }
    return (int)$row['attempts'] >= 5 ? max(1, 240 - $elapsed) : 0;
}

function recordFailedLogin(PDO $db, string $rateKey): void {
    $st = $db->prepare('SELECT attempts, DATEDIFF(SECOND, window_started, SYSUTCDATETIME()) AS elapsed FROM dbo.login_rate_limits WHERE rate_key=?');
    $st->execute([$rateKey]);
    $row = $st->fetch();
    if (!$row || (int)$row['elapsed'] >= 240) {
        $db->prepare('MERGE dbo.login_rate_limits AS target USING (SELECT ? AS rate_key) AS source ON target.rate_key=source.rate_key WHEN MATCHED THEN UPDATE SET attempts=1, window_started=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT (rate_key, attempts, window_started) VALUES (source.rate_key, 1, SYSUTCDATETIME());')->execute([$rateKey]);
        return;
    }
    $db->prepare('UPDATE dbo.login_rate_limits SET attempts=attempts+1 WHERE rate_key=?')->execute([$rateKey]);
}

function clearLoginRateLimit(PDO $db, string $rateKey): void {
    $db->prepare('DELETE FROM dbo.login_rate_limits WHERE rate_key=?')->execute([$rateKey]);
}

function normalizeAssetUrl(?string $value): ?string {
    if ($value === null || $value === '') return null;
    $normalized = trim((string)$value);
    if ($normalized === '') return null;

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

try {
    $db=capraDb();
    $rateKey = loginRateKey($email);
    $retryAfter = checkLoginRateLimit($db, $rateKey);
    if ($retryAfter > 0) {
        http_response_code(429);
        echo json_encode(['success'=>false,'message'=>'Too many failed login attempts. Please try again in 4 minutes.','retry_after'=>$retryAfter]);
        exit;
    }
    ensureAdminPresenceColumns($db);
    $sources=[
        ['table'=>'admin_staff','id'=>'adminID','role'=>'admin','extra'=>' AND deleted_at IS NULL','active'=>'LOWER(ISNULL(status,\'active\')) IN (\'active\',\'approved\')'],
        ['table'=>'trainers','id'=>'trainerID','role'=>'trainer','extra'=>' AND deleted_at IS NULL','active'=>'LOWER(ISNULL(status,\'active\')) = \'active\''],
        ['table'=>'members','id'=>'memberID','role'=>'member','extra'=>' AND deleted_at IS NULL','active'=>"LOWER(ISNULL(status,''))='active' AND LOWER(ISNULL(approval_status,'')) IN ('approved','active')"],
    ];
    foreach($sources as $src){
        $sql="SELECT {$src['id']} AS id, full_name, email, password, status".($src['role']==='member'?', approval_status, profile_photo':'').($src['role']==='trainer'?', expertise_area, phone_number, profile_photo':'').($src['role']==='admin'?', profile_photo':'')." FROM {$src['table']} WHERE email=? {$src['extra']}";
        $st=$db->prepare($sql); $st->execute([$email]); $u=$st->fetch();
        if(!$u) continue;
        if(!verifyAndUpgrade($password,(string)$u['password'])) { recordFailedLogin($db, $rateKey); http_response_code(401); echo json_encode(['success'=>false,'message'=>'Invalid email or password']); exit; }
        if(!preg_match('/WHERE email=/',$sql)) { }
        $activeOk=$db->prepare("SELECT CASE WHEN {$src['active']} THEN 1 ELSE 0 END AS ok FROM {$src['table']} WHERE {$src['id']}=?");
        $activeOk->execute([(int)$u['id']]); if(!(int)$activeOk->fetchColumn()){ http_response_code(403); echo json_encode(['success'=>false,'message'=>$src['role']==='member'?'Your account is pending approval or inactive. Please contact admin.':'Your account is inactive. Please contact admin.']); exit; }
        $newHash=upgradedHash($password,(string)$u['password']);
        if($newHash){ $up=$db->prepare("UPDATE {$src['table']} SET password=? WHERE {$src['id']}=?"); $up->execute([$newHash,(int)$u['id']]); }
        $role=$src['role'];
        if ($role === 'admin') {
            $presence = $db->prepare("UPDATE admin_staff SET last_login=GETDATE(), last_seen=GETDATE() WHERE adminID=?");
            $presence->execute([(int)$u['id']]);
            auditAdminAction($db, ['sub' => (int)$u['id'], 'role' => $role], 'login');
        }
        $user=['id'=>(int)$u['id'],'fullName'=>$u['full_name'],'full_name'=>$u['full_name'],'email'=>$u['email'],'role'=>$role,'type'=>$role==='admin'?'Admin':$role];
        if($role==='trainer') { $user['expertise_area']=$u['expertise_area'] ?? null; $user['phone_number']=$u['phone_number'] ?? null; $user['profile_photo']=normalizeAssetUrl($u['profile_photo'] ?? null); }
        if($role==='member') { $user['memberID']=(int)$u['id']; $user['full_name']=$u['full_name']; $user['profile_photo']=normalizeAssetUrl($u['profile_photo'] ?? null); }
        if($role==='admin') $user['profile_photo']=normalizeAssetUrl($u['profile_photo'] ?? null);
        clearLoginRateLimit($db, $rateKey);
        echo json_encode(['success'=>true,'message'=>'Login successful','token'=>issueAuthToken((int)$u['id'],$role,$u['email']),'user'=>$user]); exit;
    }
    recordFailedLogin($db, $rateKey);
    http_response_code(401); echo json_encode(['success'=>false,'message'=>'Invalid email or password']);
} catch(Throwable $e){ error_log('Login error: '.$e->getMessage()); http_response_code(500); echo json_encode(['success'=>false,'message'=>'Database error occurred. Please try again later.']); }
