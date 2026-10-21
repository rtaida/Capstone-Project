<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config/auth.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/config/audit.php';

function auditRespond(bool $success, string $message = '', array $extra = [], int $status = 200): never
{
    http_response_code($status);
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $extra));
    exit;
}

try {
    $authUser = requireRole(['admin', 'staff']);
    $db = capraDb();
    ensureAuditTrailTable($db);

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['action'] ?? '') === 'generate_report') {
        $input = json_decode(file_get_contents('php://input'), true);
        $input = is_array($input) ? $input : [];
        $month = trim((string) ($input['month'] ?? ''));
        $year = trim((string) ($input['year'] ?? ''));
        $period = $month !== '' && $year !== '' ? " for {$month} {$year}" : '';
        auditAdminAction($db, $authUser, 'generate_report');
        auditAdminActionDetail($db, $authUser, 'generate_report', "Generated system report{$period}");
        auditRespond(true, 'Report generation recorded.');
    }

    $limit = min(max((int)($_GET['limit'] ?? 20), 20), 100);
    $type = strtolower(trim((string)($_GET['type'] ?? 'all')));
    if (!in_array($type, ['all', 'action', 'error'], true)) {
        auditRespond(false, 'Invalid audit type.', [], 400);
    }

    $adminActionFilter = "(
        action IS NULL
        OR (
            LOWER(LTRIM(RTRIM(action))) <> 'add'
            AND LOWER(LTRIM(RTRIM(action))) NOT LIKE 'added notification%'
        )
    )";
    $actionWhere = "WHERE action_type = 'action'
                    AND NULLIF(LTRIM(RTRIM(error_part)), '') IS NULL
                    AND {$adminActionFilter}";
    $errorWhere = "WHERE action_type = 'error'
                   OR NULLIF(LTRIM(RTRIM(error_part)), '') IS NOT NULL";

    $fetchPage = static function (string $where, int $page) use ($db, $limit): array {
        $countStmt = $db->query("SELECT COUNT(*) FROM dbo.audit_trail {$where}");
        $total = (int)$countStmt->fetchColumn();
        $totalPages = max(1, (int)ceil($total / $limit));
        $page = min(max($page, 1), $totalPages);
        $offset = ($page - 1) * $limit;

        $stmt = $db->query(
            "SELECT id, actor_name, position, action,
                CASE
                    WHEN NULLIF(LTRIM(RTRIM(error_part)), '') IS NOT NULL THEN 'error'
                    ELSE action_type
                END AS action_type,
                error_part, created_at
             FROM dbo.audit_trail
             {$where}
             ORDER BY created_at DESC, id DESC
             OFFSET {$offset} ROWS FETCH NEXT {$limit} ROWS ONLY"
        );
        $records = array_map(static function (array $row): array {
            return [
                'id' => (int)$row['id'],
                'name' => $row['actor_name'],
                'role' => $row['position'],
                'action' => $row['action'],
                'type' => $row['action_type'],
                'error_part' => $row['error_part'],
                'date' => $row['created_at'],
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC));

        return [
            'records' => $records,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ];
    };

    if ($type === 'all') {
        $actionPage = max(1, (int)($_GET['action_page'] ?? 1));
        $errorPage = max(1, (int)($_GET['error_page'] ?? 1));
        $actionResult = $fetchPage($actionWhere, $actionPage);
        $errorResult = $fetchPage($errorWhere, $errorPage);
        auditRespond(true, '', [
            'records' => array_merge($actionResult['records'], $errorResult['records']),
            'pagination' => [
                'action' => $actionResult['pagination'],
                'error' => $errorResult['pagination'],
            ],
        ]);
    }

    $page = max(1, (int)($_GET['page'] ?? 1));
    $result = $fetchPage($type === 'action' ? $actionWhere : $errorWhere, $page);
    auditRespond(true, '', [
        'records' => $result['records'],
        'pagination' => [$type => $result['pagination']],
    ]);
} catch (Throwable $e) {
    error_log('audit_api.php: ' . $e->getMessage());
    auditRespond(false, 'Audit trail service error.', [], 500);
}
