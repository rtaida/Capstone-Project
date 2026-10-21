<?php

function ensureMemberIdentitySchema(PDO $conn): void
{
    if (!$conn->query("SELECT COL_LENGTH('dbo.members', 'date_of_birth')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.members ADD date_of_birth DATE NULL");
    }
    if (!$conn->query("SELECT COL_LENGTH('dbo.members', 'first_name')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.members ADD first_name NVARCHAR(100) NULL");
    }
    if (!$conn->query("SELECT COL_LENGTH('dbo.members', 'last_name')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.members ADD last_name NVARCHAR(100) NULL");
    }
    if (!$conn->query("SELECT COL_LENGTH('dbo.members', 'middle_initial')")->fetchColumn()) {
        $conn->exec("ALTER TABLE dbo.members ADD middle_initial NVARCHAR(5) NOT NULL CONSTRAINT DF_members_middle_initial DEFAULT N''");
    }

    $conn->exec("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_members_name_parts' AND object_id = OBJECT_ID(N'dbo.members'))
        CREATE UNIQUE INDEX UX_members_name_parts ON dbo.members(first_name, last_name, middle_initial)
        WHERE first_name IS NOT NULL AND last_name IS NOT NULL AND deleted_at IS NULL");
}

function normalizeMemberNamePart($value): string
{
    return trim((string) preg_replace('/\s+/u', ' ', trim((string) $value)));
}

function memberNamePartsFromInput(array $input): array
{
    $firstName = normalizeMemberNamePart($input['first_name'] ?? '');
    $lastName = normalizeMemberNamePart($input['last_name'] ?? '');
    $middleInitial = normalizeMemberNamePart($input['middle_initial'] ?? '');

    if (($firstName === '' || $lastName === '') && !empty($input['full_name'])) {
        $tokens = preg_split('/\s+/u', normalizeMemberNamePart($input['full_name'])) ?: [];
        if ($tokens) {
            $firstName = $firstName ?: array_shift($tokens);
            if ($tokens && preg_match('/^\p{L}\.?$/u', $tokens[0])) {
                $middleInitial = $middleInitial ?: rtrim(array_shift($tokens), '.');
            }
            $lastName = $lastName ?: implode(' ', $tokens);
        }
    }

    $middleInitial = strtoupper(rtrim($middleInitial, '.'));
    return [$firstName, $lastName, $middleInitial];
}

function buildMemberFullName(string $firstName, string $lastName, string $middleInitial = ''): string
{
    $middle = $middleInitial !== '' ? " {$middleInitial}." : '';
    return trim("{$firstName}{$middle} {$lastName}");
}

function memberNamePartsValidationMessage(string $firstName, string $lastName, string $middleInitial): ?string
{
    if ($firstName === '' || $lastName === '') {
        return 'First name and last name are required';
    }
    if (!preg_match('/^.{1,100}$/u', $firstName) || !preg_match('/^.{1,100}$/u', $lastName)) {
        return 'First and last names must be 100 characters or fewer';
    }
    if ($middleInitial !== '' && !preg_match('/^\p{L}$/u', $middleInitial)) {
        return 'Middle initial must be one letter';
    }
    return null;
}

function normalizeMemberNameForMatch(string $name): string
{
    $normalized = strtolower($name);
    $normalized = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $normalized) ?? $normalized;
    return trim(preg_replace('/\s+/u', ' ', $normalized) ?? $normalized);
}

function memberIdentityDuplicateMessage(PDO $conn, string $email, string $firstName, string $lastName, string $middleInitial, int $excludeMemberId = 0): ?string
{
    $emailSql = 'SELECT COUNT(*) FROM dbo.members WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(?)';
    $emailParams = [trim($email)];
    if ($excludeMemberId > 0) {
        $emailSql .= ' AND memberID <> ?';
        $emailParams[] = $excludeMemberId;
    }
    $emailStmt = $conn->prepare($emailSql);
    $emailStmt->execute($emailParams);
    if ((int) $emailStmt->fetchColumn() > 0) {
        return 'Email already exists';
    }

    $nameSql = "SELECT COUNT(*) FROM dbo.members
                WHERE LOWER(LTRIM(RTRIM(first_name))) = LOWER(?)
                  AND LOWER(LTRIM(RTRIM(last_name))) = LOWER(?)
                  AND LOWER(LTRIM(RTRIM(middle_initial))) = LOWER(?)
                  AND deleted_at IS NULL";
    $nameParams = [$firstName, $lastName, $middleInitial];
    if ($excludeMemberId > 0) {
        $nameSql .= ' AND memberID <> ?';
        $nameParams[] = $excludeMemberId;
    }
    $nameStmt = $conn->prepare($nameSql);
    $nameStmt->execute($nameParams);
    if ((int) $nameStmt->fetchColumn() > 0) {
        return 'A member with these name details already exists';
    }

    $legacySql = 'SELECT full_name FROM dbo.members WHERE deleted_at IS NULL AND (first_name IS NULL OR last_name IS NULL)';
    $legacyParams = [];
    if ($excludeMemberId > 0) {
        $legacySql .= ' AND memberID <> ?';
        $legacyParams[] = $excludeMemberId;
    }
    $legacyStmt = $conn->prepare($legacySql);
    $legacyStmt->execute($legacyParams);
    $targetNames = [normalizeMemberNameForMatch(buildMemberFullName($firstName, $lastName, $middleInitial))];
    if ($middleInitial === '') {
        $targetNames[] = normalizeMemberNameForMatch("{$firstName} {$lastName}");
        $targetNames[] = normalizeMemberNameForMatch("{$lastName} {$firstName}");
    }
    foreach ($legacyStmt->fetchAll(PDO::FETCH_COLUMN) as $legacyName) {
        if (in_array(normalizeMemberNameForMatch((string) $legacyName), $targetNames, true)) {
            return 'A member with these name details already exists';
        }
    }

    return null;
}