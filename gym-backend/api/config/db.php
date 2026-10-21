<?php
declare(strict_types=1);
require_once __DIR__ . '/env.php';
capraLoadEnv();

function capraDb(): PDO
{
    $server = getenv('CAPRA_DB_SERVER') ?: 'localhost\\SQLEXPRESS';
    $database = getenv('CAPRA_DB_NAME') ?: 'GymDB';
    $dsn = "odbc:Driver={ODBC Driver 18 for SQL Server};Server={$server};Database={$database};Trusted_Connection=yes;TrustServerCertificate=yes;";
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('SET NOCOUNT ON');
    return $pdo;
}
