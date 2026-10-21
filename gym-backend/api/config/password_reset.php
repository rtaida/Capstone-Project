<?php
declare(strict_types=1);

function ensurePasswordResetAccountColumns(PDO $conn): void
{
    if (!$conn->query("SELECT COL_LENGTH('dbo.password_reset_otps', 'account_role')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.password_reset_otps ADD account_role NVARCHAR(20) NULL");
    }
    if (!$conn->query("SELECT COL_LENGTH('dbo.password_reset_otps', 'account_id')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.password_reset_otps ADD account_id INT NULL");
    }

    $foreignKey = $conn->query(
        "SELECT TOP 1 fk.name
         FROM sys.foreign_keys fk
         WHERE fk.parent_object_id = OBJECT_ID(N'dbo.password_reset_otps')
           AND fk.referenced_object_id = OBJECT_ID(N'dbo.members')"
    )->fetchColumn();
    if ($foreignKey) {
        $escapedName = str_replace(']', ']]', (string) $foreignKey);
        $conn->exec("ALTER TABLE dbo.password_reset_otps DROP CONSTRAINT [{$escapedName}]");
    }

    $memberIdColumn = $conn->query(
        "SELECT is_nullable
         FROM sys.columns
         WHERE object_id = OBJECT_ID(N'dbo.password_reset_otps')
           AND name = 'memberID'"
    )->fetchColumn();
    if ((int) $memberIdColumn === 0) {
        $conn->exec("ALTER TABLE dbo.password_reset_otps ALTER COLUMN memberID INT NULL");
    }
}

function findPasswordResetAccount(PDO $conn, string $email): ?array
{
    $stmt = $conn->prepare(
        "SELECT TOP 1 account_id, account_role, full_name, email
         FROM (
             SELECT memberID AS account_id, 'member' AS account_role, full_name, email, deleted_at
             FROM dbo.members
             WHERE LOWER(email) = LOWER(?) AND deleted_at IS NULL AND LOWER(ISNULL(status, '')) = 'active'
             UNION ALL
             SELECT trainerID AS account_id, 'trainer' AS account_role, full_name, email, deleted_at
             FROM dbo.trainers
             WHERE LOWER(email) = LOWER(?) AND deleted_at IS NULL AND LOWER(ISNULL(status, '')) = 'active'
             UNION ALL
             SELECT adminID AS account_id, 'admin' AS account_role, full_name, email, deleted_at
             FROM dbo.admin_staff
             WHERE LOWER(email) = LOWER(?) AND deleted_at IS NULL
               AND LOWER(ISNULL(status, 'active')) IN ('active', 'approved')
         ) accounts
         ORDER BY CASE account_role WHEN 'member' THEN 1 WHEN 'trainer' THEN 2 ELSE 3 END"
    );
    $stmt->execute([$email, $email, $email]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);
    return $account ?: null;
}

function updatePasswordResetAccount(PDO $conn, string $role, int $accountId, string $password): bool
{
    $tables = [
        'member' => ['table' => 'dbo.members', 'id' => 'memberID'],
        'trainer' => ['table' => 'dbo.trainers', 'id' => 'trainerID'],
        'admin' => ['table' => 'dbo.admin_staff', 'id' => 'adminID'],
    ];
    if (!isset($tables[$role])) {
        return false;
    }

    $target = $tables[$role];
    $stmt = $conn->prepare(
        "UPDATE {$target['table']} SET password = ? WHERE {$target['id']} = ? AND deleted_at IS NULL"
    );
    $stmt->execute([$password, $accountId]);
    return $stmt->rowCount() === 1;
}
