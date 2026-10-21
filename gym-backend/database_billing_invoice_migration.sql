USE [GymDB];
GO

IF OBJECT_ID(N'dbo.bill_details', N'U') IS NULL
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
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_bill_details_admin' AND parent_object_id=OBJECT_ID(N'dbo.bill_details'))
    ALTER TABLE dbo.bill_details ADD CONSTRAINT FK_bill_details_admin FOREIGN KEY (admin_staff_id) REFERENCES dbo.admin_staff(adminID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_bill_details_member' AND parent_object_id=OBJECT_ID(N'dbo.bill_details'))
    ALTER TABLE dbo.bill_details ADD CONSTRAINT FK_bill_details_member FOREIGN KEY (member_id) REFERENCES dbo.members(memberID);
GO

IF OBJECT_ID(N'dbo.billing_records', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.billing_records', 'payment_id') IS NOT NULL
   AND COL_LENGTH('dbo.billing_records', 'walk_in_id') IS NULL
    ALTER TABLE dbo.billing_records ADD walk_in_id INT NULL;
GO

IF OBJECT_ID(N'dbo.billing_records', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.billing_records', 'payment_id') IS NOT NULL
   AND OBJECT_ID(N'dbo.billing_records_legacy_migrated', N'U') IS NULL
BEGIN
    IF OBJECT_ID(N'dbo.billing_records_legacy', N'U') IS NULL
        EXEC sp_rename 'dbo.billing_records', 'billing_records_legacy';

    CREATE TABLE dbo.billing_records (
        bill_id INT NOT NULL,
        attendance_id INT NULL,
        amount DECIMAL(10,2) NOT NULL,
        CONSTRAINT FK_billing_records_bill FOREIGN KEY (bill_id) REFERENCES dbo.bill_details(bill_id),
        CONSTRAINT FK_billing_records_attendance FOREIGN KEY (attendance_id) REFERENCES dbo.attendance_records(id),
        CONSTRAINT CK_billing_records_amount CHECK (amount >= 0)
    );

    CREATE TABLE #InvoiceMigrationMap (
        member_id INT NULL,
        walk_in_id INT NULL,
        invoice_status VARCHAR(20) NOT NULL,
        bill_id INT NOT NULL
    );

    DECLARE @member_id INT;
    DECLARE @walk_in_id INT;
    DECLARE @invoice_status VARCHAR(20);
    DECLARE @total_amount DECIMAL(10,2);
    DECLARE @created_at DATETIME;
    DECLARE @resolved_at DATETIME;
    DECLARE @bill_id INT;

    DECLARE invoice_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT member_id, walk_in_id,
               CASE WHEN billing_status = 'paid' THEN 'paid' ELSE 'pending' END AS invoice_status,
               SUM(amount_due), MIN(created_at), MAX(resolved_at)
        FROM dbo.billing_records_legacy
        WHERE billing_status IN ('open','paid')
        GROUP BY member_id, walk_in_id,
                 CASE WHEN billing_status = 'paid' THEN 'paid' ELSE 'pending' END;

    OPEN invoice_cursor;
    FETCH NEXT FROM invoice_cursor INTO @member_id, @walk_in_id, @invoice_status, @total_amount, @created_at, @resolved_at;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        INSERT INTO dbo.bill_details (admin_staff_id, member_id, walk_in_id, total_amount, description, status, created_at, resolved_at)
        VALUES (NULL, @member_id, @walk_in_id, @total_amount, N'Migrated invoice from legacy billing records', @invoice_status, @created_at, @resolved_at);
        SET @bill_id = CAST(SCOPE_IDENTITY() AS INT);
        INSERT INTO #InvoiceMigrationMap (member_id, walk_in_id, invoice_status, bill_id)
        VALUES (@member_id, @walk_in_id, @invoice_status, @bill_id);
        FETCH NEXT FROM invoice_cursor INTO @member_id, @walk_in_id, @invoice_status, @total_amount, @created_at, @resolved_at;
    END;
    CLOSE invoice_cursor;
    DEALLOCATE invoice_cursor;

    INSERT INTO dbo.billing_records (bill_id, attendance_id, amount)
    SELECT map.bill_id, COALESCE(old.attendance_id, p.attendance_id), SUM(old.amount_due)
    FROM dbo.billing_records_legacy old
    LEFT JOIN dbo.payments p ON p.payment_id = old.payment_id
    INNER JOIN #InvoiceMigrationMap map
        ON ISNULL(map.member_id, 0) = ISNULL(old.member_id, 0)
       AND ISNULL(map.walk_in_id, 0) = ISNULL(old.walk_in_id, 0)
       AND map.invoice_status = CASE WHEN old.billing_status = 'paid' THEN 'paid' ELSE 'pending' END
    WHERE old.billing_status IN ('open','paid')
    GROUP BY map.bill_id, COALESCE(old.attendance_id, p.attendance_id);

    DROP TABLE #InvoiceMigrationMap;
    EXEC sp_rename 'dbo.billing_records_legacy', 'billing_records_legacy_migrated';
END
ELSE IF OBJECT_ID(N'dbo.billing_records', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.billing_records (
        bill_id INT NOT NULL,
        attendance_id INT NULL,
        amount DECIMAL(10,2) NOT NULL,
        CONSTRAINT FK_billing_records_bill FOREIGN KEY (bill_id) REFERENCES dbo.bill_details(bill_id),
        CONSTRAINT FK_billing_records_attendance FOREIGN KEY (attendance_id) REFERENCES dbo.attendance_records(id),
        CONSTRAINT CK_billing_records_amount CHECK (amount >= 0)
    );
END
GO

IF OBJECT_ID(N'dbo.billing_records', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.billing_records', 'payment_id') IS NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_billing_records_bill' AND object_id=OBJECT_ID(N'dbo.billing_records'))
    CREATE INDEX IX_billing_records_bill ON dbo.billing_records(bill_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_bill_details_member' AND object_id=OBJECT_ID(N'dbo.bill_details'))
    CREATE INDEX IX_bill_details_member ON dbo.bill_details(member_id, created_at DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_bill_details_pending_member' AND object_id=OBJECT_ID(N'dbo.bill_details'))
    CREATE UNIQUE INDEX UX_bill_details_pending_member ON dbo.bill_details(member_id) WHERE member_id IS NOT NULL AND status='pending';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_bill_details_pending_walkin' AND object_id=OBJECT_ID(N'dbo.bill_details'))
    CREATE UNIQUE INDEX UX_bill_details_pending_walkin ON dbo.bill_details(walk_in_id) WHERE walk_in_id IS NOT NULL AND status='pending';
GO
