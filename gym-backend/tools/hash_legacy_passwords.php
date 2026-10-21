<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "Run this script from the command line only.\n"); exit(1); }
require_once __DIR__.'/../api/config/db.php';
$db=capraDb();
$targets=[['admin_staff','adminID'],['trainers','trainerID'],['members','memberID']];
foreach($targets as [$table,$id]){
  $rows=$db->query("SELECT {$id} AS id, password FROM dbo.{$table}")->fetchAll();
  foreach($rows as $row){
    $stored=(string)$row['password'];
    if($stored!=='' && (str_starts_with($stored,'$2y$')||str_starts_with($stored,'$argon2'))) continue;
    $hash=password_hash($stored,PASSWORD_DEFAULT);
    $st=$db->prepare("UPDATE dbo.{$table} SET password=? WHERE {$id}=?");
    $st->execute([$hash,(int)$row['id']]);
    echo "Hardened {$table} #{$row['id']}\n";
  }
}
echo "Legacy password migration complete.\n";
