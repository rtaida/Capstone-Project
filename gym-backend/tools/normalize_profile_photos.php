<?php

$baseHost = getenv('APP_HOST') ?: '192.168.100.154';
$scheme = getenv('APP_SCHEME') ?: 'http';
$baseUrl = rtrim($scheme . '://' . $baseHost, '/');

function normalizeAssetUrl(?string $value): ?string
{
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

try {
    $pdo = new PDO(
        'odbc:Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=GymDB;Trusted_Connection=yes;TrustServerCertificate=yes;'
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $tables = [
        'members' => 'memberID',
        'admin_staff' => 'adminID',
        'trainers' => 'trainerID',
    ];

    foreach ($tables as $table => $idField) {
        $stmt = $pdo->query("SELECT $idField, profile_photo FROM dbo.$table WHERE profile_photo IS NOT NULL AND (profile_photo LIKE '%localhost%' OR profile_photo LIKE '%127.0.0.1%' OR profile_photo LIKE '%0.0.0.0%' OR profile_photo LIKE '%192.168.%' OR profile_photo LIKE 'http://%' OR profile_photo LIKE 'https://%')");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo "Table {$table}: " . count($rows) . " stale photo references found\n";

        foreach ($rows as $row) {
            $id = (int) ($row[$idField] ?? 0);
            $value = (string) ($row['profile_photo'] ?? '');
            $normalized = normalizeAssetUrl($value);

            if ($normalized === null || $normalized === '') {
                continue;
            }

            $update = $pdo->prepare("UPDATE dbo.$table SET profile_photo = ? WHERE $idField = ?");
            $update->execute([$normalized, $id]);
        }

        $count = $pdo->query("SELECT COUNT(*) FROM dbo.$table WHERE profile_photo IS NOT NULL AND (profile_photo LIKE '%localhost%' OR profile_photo LIKE '%127.0.0.1%' OR profile_photo LIKE '%0.0.0.0%' OR profile_photo LIKE '%192.168.%' OR profile_photo LIKE 'http://%' OR profile_photo LIKE 'https://%')")->fetchColumn();
        echo "Table {$table}: remaining stale references = {$count}\n";
    }

    $memberRows = $pdo->query("SELECT memberID, qr_code FROM dbo.members WHERE qr_code IS NOT NULL AND (qr_code LIKE '%localhost%' OR qr_code LIKE '%127.0.0.1%' OR qr_code LIKE '%0.0.0.0%' OR qr_code LIKE '%192.168.%' OR qr_code LIKE 'http://%' OR qr_code LIKE 'https://%')")->fetchAll(PDO::FETCH_ASSOC);
    echo "Table members qr_code: " . count($memberRows) . " stale QR references found\n";

    foreach ($memberRows as $row) {
        $id = (int) ($row['memberID'] ?? 0);
        $value = (string) ($row['qr_code'] ?? '');
        $normalized = normalizeAssetUrl($value);
        if ($normalized === null || $normalized === '') {
            continue;
        }

        $update = $pdo->prepare('UPDATE dbo.members SET qr_code = ? WHERE memberID = ?');
        $update->execute([$normalized, $id]);
    }

    $countQr = $pdo->query("SELECT COUNT(*) FROM dbo.members WHERE qr_code IS NOT NULL AND (qr_code LIKE '%localhost%' OR qr_code LIKE '%127.0.0.1%' OR qr_code LIKE '%0.0.0.0%' OR qr_code LIKE '%192.168.%' OR qr_code LIKE 'http://%' OR qr_code LIKE 'https://%')")->fetchColumn();
    echo "Table members: remaining stale qr references = {$countQr}\n";

    echo "Done.\n";
} catch (Throwable $e) {
    echo "Failed: " . $e->getMessage() . PHP_EOL;
    exit(1);
}
