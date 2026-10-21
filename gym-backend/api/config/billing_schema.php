<?php

function ensureCheckConstraint(PDO $conn, string $tableName, string $constraintName, string $checkExpression): void
{
    $tableExists = (int) $conn->query("SELECT CASE WHEN OBJECT_ID(N'dbo.{$tableName}', N'U') IS NOT NULL THEN 1 ELSE 0 END")->fetchColumn();
    if ($tableExists !== 1) {
        return;
    }

    $findConstraint = $conn->prepare(
        'SELECT definition FROM sys.check_constraints WHERE name = ? AND parent_object_id = OBJECT_ID(?)'
    );
    $findConstraint->execute([$constraintName, 'dbo.' . $tableName]);
    $definition = $findConstraint->fetchColumn();
    if ($definition !== false) {
        preg_match('/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+IN\b/i', $checkExpression, $columnMatch);
        preg_match_all("/'([^']*)'/", (string) $definition, $definitionValues);
        preg_match_all("/'([^']*)'/", $checkExpression, $expectedValues);
        $definitionValues = $definitionValues[1] ?? [];
        $expectedValues = $expectedValues[1] ?? [];
        sort($definitionValues);
        sort($expectedValues);
        $normalizedDefinition = strtolower(str_replace(['[', ']'], '', (string) $definition));
        if (
            isset($columnMatch[1]) &&
            strpos($normalizedDefinition, strtolower($columnMatch[1])) !== false &&
            $definitionValues === $expectedValues
        ) {
            return;
        }

        try {
            $conn->exec(sprintf("ALTER TABLE dbo.%s DROP CONSTRAINT [%s];", $tableName, $constraintName));
        } catch (Throwable $e) {
            $msg = strtolower($e->getMessage());
            if (strpos($msg, 'is not a constraint') === false && strpos($msg, 'does not exist') === false && strpos($msg, 'not found') === false) {
                throw $e;
            }
        }
    }

    try {
        $conn->exec(sprintf("ALTER TABLE dbo.%s WITH CHECK ADD CONSTRAINT [%s] CHECK (%s);", $tableName, $constraintName, $checkExpression));
    } catch (Throwable $e) {
        $msg = strtolower($e->getMessage());
        if (strpos($msg, 'already an object named') === false && strpos($msg, 'already exists') === false && strpos($msg, 'is not a constraint') === false) {
            throw $e;
        }
    }
}

function ensureBillingSchema(PDO $conn): void
{
    $conn->exec("IF OBJECT_ID(N'dbo.bill_details', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.bill_details (
            bill_id INT IDENTITY(1,1) PRIMARY KEY,
            admin_staff_id INT NULL,
            member_id INT NULL,
            walk_in_id INT NULL,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            description NVARCHAR(1000) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT GETDATE(),
            resolved_at DATETIME NULL,
            CONSTRAINT FK_bill_details_admin FOREIGN KEY (admin_staff_id) REFERENCES dbo.admin_staff(adminID),
            CONSTRAINT FK_bill_details_member FOREIGN KEY (member_id) REFERENCES dbo.members(memberID),
            CONSTRAINT CK_bill_details_total CHECK (total_amount >= 0),
            CONSTRAINT CK_bill_details_status CHECK (status IN ('pending','partial','paid'))
        );
    END");

    ensureCheckConstraint($conn, 'bill_details', 'CK_bill_details_status', "status IN ('pending','partial','paid')");
    ensureCheckConstraint($conn, 'payments', 'CK_payments_status', "payment_status IN ('pending','paid','billed','rejected','voided','refunded')");

    $conn->exec("IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_bill_details_admin' AND parent_object_id=OBJECT_ID(N'dbo.bill_details')) ALTER TABLE dbo.bill_details ADD CONSTRAINT FK_bill_details_admin FOREIGN KEY (admin_staff_id) REFERENCES dbo.admin_staff(adminID)");
    $conn->exec("IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_bill_details_member' AND parent_object_id=OBJECT_ID(N'dbo.bill_details')) ALTER TABLE dbo.bill_details ADD CONSTRAINT FK_bill_details_member FOREIGN KEY (member_id) REFERENCES dbo.members(memberID)");

    $oldTableExists = (bool) $conn->query("SELECT OBJECT_ID(N'dbo.billing_records', N'U')")->fetchColumn();
    $isLegacyTable = $oldTableExists && (bool) $conn->query("SELECT COL_LENGTH('dbo.billing_records', 'payment_id')")->fetchColumn();
    if ($isLegacyTable && !(bool) $conn->query("SELECT OBJECT_ID(N'dbo.billing_records_legacy', N'U')")->fetchColumn()) {
        if (!(bool) $conn->query("SELECT COL_LENGTH('dbo.billing_records', 'walk_in_id')")->fetchColumn()) {
            $conn->exec("ALTER TABLE dbo.billing_records ADD walk_in_id INT NULL");
        }
        $conn->exec("EXEC sp_rename 'dbo.billing_records', 'billing_records_legacy'");
        $oldTableExists = false;
    }

    if (!(bool) $conn->query("SELECT OBJECT_ID(N'dbo.billing_records', N'U')")->fetchColumn()) {
        $conn->exec("CREATE TABLE dbo.billing_records (
            bill_id INT NOT NULL,
            attendance_id INT NULL,
            amount DECIMAL(10,2) NOT NULL,
            CONSTRAINT FK_billing_records_bill FOREIGN KEY (bill_id) REFERENCES dbo.bill_details(bill_id),
            CONSTRAINT FK_billing_records_attendance FOREIGN KEY (attendance_id) REFERENCES dbo.attendance_records(id),
            CONSTRAINT CK_billing_records_amount CHECK (amount >= 0)
        )");
    }

    $conn->exec("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_billing_records_bill' AND object_id=OBJECT_ID(N'dbo.billing_records')) CREATE INDEX IX_billing_records_bill ON dbo.billing_records(bill_id)");
    $conn->exec("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_bill_details_member' AND object_id=OBJECT_ID(N'dbo.bill_details')) CREATE INDEX IX_bill_details_member ON dbo.bill_details(member_id, created_at DESC)");
    $conn->exec("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_bill_details_pending_member' AND object_id=OBJECT_ID(N'dbo.bill_details')) CREATE UNIQUE INDEX UX_bill_details_pending_member ON dbo.bill_details(member_id) WHERE member_id IS NOT NULL AND status='pending'");
    $conn->exec("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_bill_details_pending_walkin' AND object_id=OBJECT_ID(N'dbo.bill_details')) CREATE UNIQUE INDEX UX_bill_details_pending_walkin ON dbo.bill_details(walk_in_id) WHERE walk_in_id IS NOT NULL AND status='pending'");

    $legacyExists = (bool) $conn->query("SELECT OBJECT_ID(N'dbo.billing_records_legacy', N'U')")->fetchColumn();
    $migrated = (bool) $conn->query("SELECT OBJECT_ID(N'dbo.billing_records_legacy_migrated', N'U')")->fetchColumn();
    if ($legacyExists && !$migrated) {
        $conn->beginTransaction();
        try {
            $legacyRows = $conn->query("SELECT billing_id, payment_id, member_id, walk_in_id, attendance_id, amount_due, billing_status, notes, created_at, resolved_at
                FROM dbo.billing_records_legacy
                WHERE billing_status IN ('open','paid')
                ORDER BY billing_id")->fetchAll(PDO::FETCH_ASSOC);
            $invoiceMap = [];
            $insertInvoice = $conn->prepare("INSERT INTO dbo.bill_details (admin_staff_id, member_id, walk_in_id, total_amount, description, status, created_at, resolved_at)
                OUTPUT INSERTED.bill_id VALUES (NULL, ?, ?, 0, ?, ?, ?, ?)");
            $insertLine = $conn->prepare('INSERT INTO dbo.billing_records (bill_id, attendance_id, amount) VALUES (?, ?, ?)');
            $sumByInvoice = [];

            foreach ($legacyRows as $legacy) {
                $status = strtolower((string) $legacy['billing_status']) === 'paid' ? 'paid' : 'pending';
                $memberId = $legacy['member_id'] !== null ? (int) $legacy['member_id'] : null;
                $walkInId = $legacy['walk_in_id'] !== null ? (int) $legacy['walk_in_id'] : null;
                $groupKey = implode(':', [$memberId ?? 0, $walkInId ?? 0, $status]);
                if (!isset($invoiceMap[$groupKey])) {
                    $description = 'Migrated invoice from legacy billing records';
                    $insertInvoice->execute([
                        $memberId,
                        $walkInId,
                        $description,
                        $status,
                        $legacy['created_at'],
                        $legacy['resolved_at'],
                    ]);
                    $invoiceMap[$groupKey] = (int) $insertInvoice->fetchColumn();
                    if ($invoiceMap[$groupKey] <= 0) {
                        throw new RuntimeException('Unable to migrate a legacy billing invoice.');
                    }
                    $sumByInvoice[$groupKey] = 0.0;
                }

                $attendanceId = $legacy['attendance_id'] !== null ? (int) $legacy['attendance_id'] : null;
                if (!$attendanceId && (int) ($legacy['payment_id'] ?? 0) > 0) {
                    $paymentLookup = $conn->prepare('SELECT attendance_id FROM dbo.payments WHERE payment_id = ?');
                    $paymentLookup->execute([(int) $legacy['payment_id']]);
                    $paymentAttendance = $paymentLookup->fetchColumn();
                    $attendanceId = $paymentAttendance !== false && $paymentAttendance !== null ? (int) $paymentAttendance : null;
                }
                if ($attendanceId !== null) {
                    $attendanceExists = $conn->prepare('SELECT COUNT(*) FROM dbo.attendance_records WHERE id = ?');
                    $attendanceExists->execute([$attendanceId]);
                    if ((int) $attendanceExists->fetchColumn() === 0) {
                        $attendanceId = null;
                    }
                }
                $amount = (float) $legacy['amount_due'];
                $insertLine->execute([$invoiceMap[$groupKey], $attendanceId, $amount]);
                $sumByInvoice[$groupKey] += $amount;
            }

            $updateTotal = $conn->prepare('UPDATE dbo.bill_details SET total_amount = ? WHERE bill_id = ?');
            foreach ($invoiceMap as $groupKey => $billId) {
                $updateTotal->execute([$sumByInvoice[$groupKey], $billId]);
            }

            $conn->exec("EXEC sp_rename 'dbo.billing_records_legacy', 'billing_records_legacy_migrated'");
            $conn->commit();
        } catch (Throwable $error) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            throw $error;
        }
    }
}

function getOrCreatePendingBill(PDO $conn, ?int $memberId, ?int $walkInId, ?int $adminStaffId, string $description): int
{
    if ($memberId !== null) {
        $stmt = $conn->prepare("SELECT TOP 1 bill_id FROM dbo.bill_details WITH (UPDLOCK, ROWLOCK)
            WHERE member_id = ? AND status = 'pending' ORDER BY bill_id DESC");
        $stmt->execute([$memberId]);
    } elseif ($walkInId !== null) {
        $stmt = $conn->prepare("SELECT TOP 1 bill_id FROM dbo.bill_details WITH (UPDLOCK, ROWLOCK)
            WHERE walk_in_id = ? AND status = 'pending' ORDER BY bill_id DESC");
        $stmt->execute([$walkInId]);
    } else {
        throw new InvalidArgumentException('A member or walk-in is required for a billing invoice.');
    }
    $billId = (int) $stmt->fetchColumn();
    if ($billId > 0) {
        return $billId;
    }

    $insert = $conn->prepare("INSERT INTO dbo.bill_details (admin_staff_id, member_id, walk_in_id, total_amount, description, status)
        OUTPUT INSERTED.bill_id VALUES (?, ?, ?, 0, ?, 'pending')");
    $insert->execute([$adminStaffId, $memberId, $walkInId, $description]);
    return (int) $insert->fetchColumn();
}

function addBillingAttendanceAmount(PDO $conn, int $billId, ?int $attendanceId, float $amount): void
{
    if ($amount < 0) {
        throw new InvalidArgumentException('Bill line amount must not be negative.');
    }
    if ($attendanceId !== null && $attendanceId <= 0) $attendanceId = null;

    $find = $conn->prepare($attendanceId === null
        ? 'SELECT TOP 1 amount FROM dbo.billing_records WITH (UPDLOCK, ROWLOCK) WHERE bill_id = ? AND attendance_id IS NULL'
        : 'SELECT TOP 1 amount FROM dbo.billing_records WITH (UPDLOCK, ROWLOCK) WHERE bill_id = ? AND attendance_id = ?');
    $find->execute($attendanceId === null ? [$billId] : [$billId, $attendanceId]);
    $existingAmount = $find->fetchColumn();
    if ($existingAmount !== false) {
        $update = $conn->prepare($attendanceId === null
            ? 'UPDATE dbo.billing_records SET amount = amount + ? WHERE bill_id = ? AND attendance_id IS NULL'
            : 'UPDATE dbo.billing_records SET amount = amount + ? WHERE bill_id = ? AND attendance_id = ?');
        $update->execute($attendanceId === null ? [$amount, $billId] : [$amount, $billId, $attendanceId]);
    } else {
        $insert = $conn->prepare('INSERT INTO dbo.billing_records (bill_id, attendance_id, amount) VALUES (?, ?, ?)');
        $insert->execute([$billId, $attendanceId, $amount]);
    }

    $total = $conn->prepare('UPDATE dbo.bill_details SET total_amount = (SELECT COALESCE(SUM(amount),0) FROM dbo.billing_records WHERE bill_id = ?) WHERE bill_id = ?');
    $total->execute([$billId, $billId]);
}
