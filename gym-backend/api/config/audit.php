<?php
declare(strict_types=1);

function ensureAuditTrailTable(PDO $db): void
{
    $db->exec("IF OBJECT_ID(N'dbo.audit_trail', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.audit_trail (
            id INT IDENTITY(1,1) PRIMARY KEY,
            actor_id INT NULL,
            actor_name NVARCHAR(255) NULL,
            position NVARCHAR(50) NULL,
            action NVARCHAR(255) NULL,
            action_type NVARCHAR(20) NOT NULL,
            error_part NVARCHAR(500) NULL,
            created_at DATETIME NOT NULL DEFAULT GETDATE()
        );
        CREATE INDEX IX_audit_trail_created_at ON dbo.audit_trail(created_at DESC);
        CREATE INDEX IX_audit_trail_action_type ON dbo.audit_trail(action_type, created_at DESC);
    END");
}

function auditAdminAction(PDO $db, array $authUser, string $action): void
{
    global $capraLastAuditId;
    $auditedActions = [
        'login', 'add', 'update', 'delete', 'restore', 'generate_qr',
        'approve_member', 'reject_member', 'confirm_payment', 'bill_payment',
        'reject_payment', 'create_walk_in', 'record_attendance',
        'save_session_type', 'delete_session_type', 'activate_session_type',
        'save_promo', 'admin_create_session', 'admin_update_session',
        'admin_terminate_session', 'approve_session', 'reject_session',
        'add_admin', 'add_trainer', 'update_admin', 'update_trainer',
        'delete_admin', 'delete_trainer', 'update', 'send_notice', 'mark_paid',
        'update_settings', 'generate_report',
    ];

    if (!in_array($action, $auditedActions, true)) {
        return;
    }

    try {
        ensureAuditTrailTable($db);
        $actorId = (int)($authUser['sub'] ?? 0);
        $actorName = 'Unknown admin';
        $position = strtolower((string)($authUser['role'] ?? 'admin'));

        if ($actorId > 0) {
            $stmt = $db->prepare('SELECT full_name, role FROM dbo.admin_staff WHERE adminID = ?');
            $stmt->execute([$actorId]);
            $actor = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($actor) {
                $actorName = (string)($actor['full_name'] ?? $actorName);
                $position = (string)($actor['role'] ?? $position);
            }
        }

        $stmt = $db->prepare(
            "INSERT INTO dbo.audit_trail (actor_id, actor_name, position, action, action_type, created_at)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, 'action', GETDATE())"
        );
        $stmt->execute([$actorId ?: null, $actorName, $position, $action]);
        $capraLastAuditId = (int) $stmt->fetchColumn();
    } catch (Throwable $e) {
        error_log('Audit action recording failed: ' . $e->getMessage());
    }
}

function auditAdminActionDetail(PDO $db, array $authUser, string $action, string $detail): void
{
    global $capraLastAuditId;
    $detail = trim($detail);
    if ($detail === '') {
        return;
    }

    try {
        ensureAuditTrailTable($db);
        $actorId = (int)($authUser['sub'] ?? 0);
        if ((int) ($capraLastAuditId ?? 0) > 0) {
            $stmt = $db->prepare(
                "UPDATE dbo.audit_trail SET action = ?
                 WHERE id = ? AND actor_id = ? AND action_type = 'action'"
            );
            $stmt->execute([$detail, (int) $capraLastAuditId, $actorId ?: null]);
            return;
        }

        $stmt = $db->prepare(
            "INSERT INTO dbo.audit_trail (actor_id, actor_name, position, action, action_type, created_at)
             VALUES (?, ?, ?, ?, 'action', GETDATE())"
        );
        $actorNameStmt = $db->prepare('SELECT full_name, role FROM dbo.admin_staff WHERE adminID = ?');
        $actorNameStmt->execute([$actorId]);
        $actor = $actorNameStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $stmt->execute([$actorId ?: null, $actor['full_name'] ?? 'Unknown admin', $actor['role'] ?? 'admin', $detail]);
    } catch (Throwable $e) {
        error_log('Audit action detail update failed: ' . $e->getMessage());
    }
}

function auditChangedFields(array $before, array $after, array $labels): array
{
    $changed = [];
    foreach ($labels as $field => $label) {
        if ((string)($before[$field] ?? '') !== (string)($after[$field] ?? '')) {
            $changed[] = $label;
        }
    }
    return $changed;
}

function auditSystemError(PDO $db, string $errorPart, ?Throwable $error = null): void
{
    try {
        ensureAuditTrailTable($db);
        global $capraLastAuditId;

        if ((int) ($capraLastAuditId ?? 0) > 0) {
            $removePendingAction = $db->prepare(
                "DELETE FROM dbo.audit_trail WHERE id = ? AND action_type = 'action'"
            );
            $removePendingAction->execute([(int) $capraLastAuditId]);
            $capraLastAuditId = 0;
        }

        $details = trim($errorPart);
        if ($error) {
            $details .= ' [' . get_class($error) . ']: ' . $error->getMessage();
        }
        $details = mb_substr($details, 0, 500);
        $stmt = $db->prepare(
            "INSERT INTO dbo.audit_trail (action_type, error_part, created_at)
             VALUES ('error', ?, GETDATE())"
        );
        $stmt->execute([$details]);
    } catch (Throwable $auditError) {
        error_log('Audit error recording failed: ' . $auditError->getMessage());
    }
}
