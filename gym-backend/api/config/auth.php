<?php
declare(strict_types=1);
require_once __DIR__ . '/env.php';
capraLoadEnv();

function b64url_encode(string $value): string { return rtrim(strtr(base64_encode($value), '+/', '-_'), '='); }
function b64url_decode(string $value): string|false { return base64_decode(strtr($value, '-_', '+/') . str_repeat('=', (4 - strlen($value) % 4) % 4)); }
function capraAuthSecret(): string
{
    capraLoadEnv();
    $secret = getenv('CAPRA_AUTH_SECRET') ?: ($_ENV['CAPRA_AUTH_SECRET'] ?? null);

    if (!$secret && is_readable(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env')) {
        $envFile = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            $pos = strpos($line, '=');
            if ($pos === false) {
                continue;
            }
            $name = trim(substr($line, 0, $pos));
            $value = trim(substr($line, $pos + 1));
            if ($name === 'CAPRA_AUTH_SECRET') {
                $secret = $value;
                break;
            }
        }
    }

    if (!$secret || strlen($secret) < 32) {
        throw new RuntimeException('CAPRA_AUTH_SECRET must be configured with at least 32 characters.');
    }
    return $secret;
}

function ensureAdminPresenceColumns(PDO $db): void
{
    try {
        if (!$db->query("SELECT COL_LENGTH('dbo.admin_staff', 'last_login')")->fetchColumn()) {
            $db->exec("ALTER TABLE dbo.admin_staff ADD last_login DATETIME NULL");
        }
        if (!$db->query("SELECT COL_LENGTH('dbo.admin_staff', 'last_seen')")->fetchColumn()) {
            $db->exec("ALTER TABLE dbo.admin_staff ADD last_seen DATETIME NULL");
        }
    } catch (Throwable $e) {
        error_log('Admin presence column check failed: ' . $e->getMessage());
    }
}

function issueAuthToken(int $id, string $role, string $email, int $ttl = 28800): string
{
    $payload = ['sub'=>$id,'role'=>$role,'email'=>$email,'iat'=>time(),'exp'=>time()+$ttl];
    $body = b64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
    $sig = b64url_encode(hash_hmac('sha256', $body, capraAuthSecret(), true));
    return $body.'.'.$sig;
}
function getBearerToken(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$header && function_exists('getallheaders')) {
        foreach (getallheaders() as $k=>$v) {
            if (strtolower($k) === 'authorization') { $header = $v; break; }
        }
    }
    if (preg_match('/^Bearer\\s+(.+)$/i', trim($header), $m)) return trim($m[1]);
    return null;
}
function currentAuth(): ?array
{
    $token = getBearerToken();
    if (!$token) return null;
    [$body,$sig] = array_pad(explode('.', $token, 2), 2, null);
    if (!$body || !$sig) return null;
    try {
        $expected = b64url_encode(hash_hmac('sha256', $body, capraAuthSecret(), true));
    } catch (Throwable $error) {
        error_log('Auth secret configuration error: ' . $error->getMessage());
        return null;
    }
    if (!hash_equals($expected, $sig)) return null;
    $payload = json_decode((string)b64url_decode($body), true);
    if (!is_array($payload) || (int)($payload['exp'] ?? 0) < time()) return null;
    if (!tokenAccountIsActive($payload)) return null;
    return $payload;
}

function tokenAccountIsActive(array $payload): bool
{
    $id = (int)($payload['sub'] ?? 0);
    $role = strtolower((string)($payload['role'] ?? ''));
    if ($id <= 0) return false;

    try {
        require_once __DIR__ . '/db.php';
        $db = capraDb();
        if (in_array($role, ['admin', 'staff'], true)) {
            $stmt = $db->prepare("SELECT TOP 1 status, deleted_at FROM dbo.admin_staff WHERE adminID = ?");
        } elseif ($role === 'trainer') {
            $stmt = $db->prepare("SELECT TOP 1 status, deleted_at FROM dbo.trainers WHERE trainerID = ?");
        } elseif ($role === 'member') {
            $stmt = $db->prepare("SELECT TOP 1 status, approval_status, deleted_at FROM dbo.members WHERE memberID = ?");
        } else {
            return false;
        }
        $stmt->execute([$id]);
        $account = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$account || !empty($account['deleted_at'])) return false;
        if (strtolower((string)($account['status'] ?? '')) !== 'active' && !in_array($role, ['admin', 'staff'], true)) return false;
        if (in_array($role, ['admin', 'staff'], true) && !in_array(strtolower((string)($account['status'] ?? 'active')), ['active', 'approved'], true)) return false;
        if ($role === 'member' && !in_array(strtolower((string)($account['approval_status'] ?? '')), ['approved', 'active'], true)) return false;
        return true;
    } catch (Throwable $error) {
        error_log('Token account validation failed: ' . $error->getMessage());
        return false;
    }
}
function authError(string $message='Authentication required.'): never
{
    http_response_code(401);
    echo json_encode(['success'=>false,'message'=>$message]);
    exit;
}
function requireRole(array $roles): array
{
    $user = currentAuth();
    if (!$user || !in_array(strtolower((string)($user['role'] ?? '')), array_map('strtolower',$roles), true)) {
        authError('You are not authorized to perform this action.');
    }
    return $user;
}
function requireAnyRole(array $roles): array
{
    return requireRole($roles);
}
function requireMemberSelf(?int $memberId=null): array
{
    $user = requireRole(['member']);
    $id = (int)($user['sub'] ?? 0);
    if ($id <= 0 || ($memberId !== null && $memberId > 0 && $id !== $memberId)) {
        authError('You can only access your own member account.');
    }
    return $user;
}
function requireTrainerSelf(?int $trainerId=null): array
{
    $user = requireRole(['trainer']);
    $id = (int)($user['sub'] ?? 0);
    if ($id <= 0 || ($trainerId !== null && $trainerId > 0 && $id !== $trainerId)) {
        authError('You can only access your own trainer account.');
    }
    return $user;
}

function requireValidToken(): array
{
    $user = currentAuth();
    if (!$user) authError('Authentication required. Please log in again.');
    return $user;
}

function requireActionRole(string $action, array $adminActions, array $trainerActions=[], array $memberActions=[]): array
{
    $user = requireValidToken();
    $role = strtolower((string) ($user['role'] ?? ''));

    if (in_array($action, $adminActions, true) && in_array($role, ['admin', 'staff'], true)) {
        require_once __DIR__ . '/db.php';
        require_once __DIR__ . '/audit.php';
        try {
            auditAdminAction(capraDb(), $user, $action);
        } catch (Throwable $e) {
            error_log('Audit setup failed: ' . $e->getMessage());
        }
        return $user;
    }
    if (in_array($action, $trainerActions, true) && in_array($role, ['trainer', 'admin', 'staff'], true)) {
        return $user;
    }
    if (in_array($action, $memberActions, true) && in_array($role, ['member', 'admin', 'staff'], true)) {
        return $user;
    }

    authError('You are not authorized to perform this action.');
}
