USE [GymDB];
GO

IF OBJECT_ID(N'dbo.walk_in_records', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.walk_in_records (
        id INT IDENTITY(1,1) PRIMARY KEY,
        client_name NVARCHAR(150) NOT NULL,
        email NVARCHAR(255) NULL,
        session_type NVARCHAR(100) NOT NULL DEFAULT N'Walk-in Regular Session',
        amount DECIMAL(10,2) NOT NULL,
        payment_method NVARCHAR(30) NOT NULL DEFAULT N'Cash',
        payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        attendance_id INT NULL,
        payment_id INT NULL,
        created_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        confirmed_at DATETIME NULL,
        confirmed_by INT NULL,
        rejection_reason NVARCHAR(500) NULL,
        CONSTRAINT CK_walk_in_amount CHECK (amount > 0),
        CONSTRAINT CK_walk_in_payment_status CHECK (payment_status IN ('pending','paid','rejected','voided'))
    );
END
GO

IF OBJECT_ID(N'dbo.walk_in_records', N'U') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.walk_in_records') AND name=N'email')
    ALTER TABLE dbo.walk_in_records ADD email NVARCHAR(255) NULL;
GO

-- Make the migration safe for databases where walk_in_records already exists
-- from an earlier Walk-in version with fewer columns.
IF COL_LENGTH('dbo.walk_in_records', 'payment_id') IS NULL
    ALTER TABLE dbo.walk_in_records ADD payment_id INT NULL;
GO
IF COL_LENGTH('dbo.walk_in_records', 'attendance_id') IS NULL
    ALTER TABLE dbo.walk_in_records ADD attendance_id INT NULL;
GO
IF COL_LENGTH('dbo.walk_in_records', 'created_by') IS NULL
    ALTER TABLE dbo.walk_in_records ADD created_by INT NULL;
GO
IF COL_LENGTH('dbo.walk_in_records', 'created_at') IS NULL
    ALTER TABLE dbo.walk_in_records ADD created_at DATETIME NOT NULL CONSTRAINT DF_walk_in_records_created_at DEFAULT GETDATE();
GO
IF COL_LENGTH('dbo.walk_in_records', 'confirmed_at') IS NULL
    ALTER TABLE dbo.walk_in_records ADD confirmed_at DATETIME NULL;
GO
IF COL_LENGTH('dbo.walk_in_records', 'confirmed_by') IS NULL
    ALTER TABLE dbo.walk_in_records ADD confirmed_by INT NULL;
GO
IF COL_LENGTH('dbo.walk_in_records', 'rejection_reason') IS NULL
    ALTER TABLE dbo.walk_in_records ADD rejection_reason NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.attendance_records', 'walk_in_id') IS NULL
    ALTER TABLE dbo.attendance_records ADD walk_in_id INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_attendance_walk_in' AND parent_object_id=OBJECT_ID('dbo.attendance_records'))
    ALTER TABLE dbo.attendance_records ADD CONSTRAINT FK_attendance_walk_in FOREIGN KEY (walk_in_id) REFERENCES dbo.walk_in_records(id);
GO

IF COL_LENGTH('dbo.payments', 'member_id') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.payments') AND name='member_id' AND is_nullable=0)
BEGIN
    ALTER TABLE dbo.payments DROP CONSTRAINT FK_payments_member;
    ALTER TABLE dbo.payments ALTER COLUMN member_id INT NULL;
    ALTER TABLE dbo.payments ADD CONSTRAINT FK_payments_member FOREIGN KEY (member_id) REFERENCES dbo.members(memberID);
END
GO

IF COL_LENGTH('dbo.payments', 'walk_in_id') IS NULL
    ALTER TABLE dbo.payments ADD walk_in_id INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_payments_walk_in' AND parent_object_id=OBJECT_ID('dbo.payments'))
    ALTER TABLE dbo.payments ADD CONSTRAINT FK_payments_walk_in FOREIGN KEY (walk_in_id) REFERENCES dbo.walk_in_records(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_payments_walk_in' AND object_id=OBJECT_ID('dbo.payments'))
    CREATE INDEX IX_payments_walk_in ON dbo.payments(walk_in_id, payment_status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_attendance_walk_in' AND object_id=OBJECT_ID('dbo.attendance_records'))
    CREATE INDEX IX_attendance_walk_in ON dbo.attendance_records(walk_in_id, attendance_date);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name=N'Walk-in Regular Session')
    INSERT INTO dbo.gym_session_types(session_name, price, is_active) VALUES(N'Walk-in Regular Session', 80.00, 1);
GO
