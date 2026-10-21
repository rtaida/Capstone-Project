IF DB_ID(N'GymDB') IS NULL
BEGIN
    CREATE DATABASE [GymDB];
END
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

USE [GymDB];
GO




IF OBJECT_ID(N'dbo.admin_staff', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.admin_staff (
        adminID INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        phone_number NVARCHAR(255) NOT NULL,
        age INT NOT NULL,
        role NVARCHAR(255) NULL,
        status NVARCHAR(255) NULL,
        password NVARCHAR(255) NOT NULL,
        created_at DATETIME NULL,
        updated_at DATETIME NULL,
        deleted_at DATETIME NULL
    );
END
GO




IF OBJECT_ID(N'dbo.trainers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.trainers (
        trainerID INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        phone_number NVARCHAR(255) NOT NULL,
        age INT NOT NULL,
        role NVARCHAR(255) NULL,
        expertise_area NVARCHAR(255) NULL,
        status NVARCHAR(255) NULL,
        password NVARCHAR(255) NOT NULL,
        created_at DATETIME NULL,
        updated_at DATETIME NULL,
        deleted_at DATETIME NULL
    );
END
GO




IF OBJECT_ID(N'dbo.members', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.members (
        memberID INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        phone NVARCHAR(255) NULL,
        weight NVARCHAR(255) NULL,
        height NVARCHAR(255) NULL,
        age INT NULL,
        gender NVARCHAR(255) NULL,
        payment_method NVARCHAR(255) NULL,
        status NVARCHAR(255) NULL,
        password NVARCHAR(255) NOT NULL,
        qr_code NVARCHAR(255) NULL,
        created_at DATETIME NULL,
        role NVARCHAR(255) NULL,
        deleted_at DATETIME NULL,
        approval_status VARCHAR(255) NULL,
        admin_notes TEXT NULL
    );
END
GO

IF COL_LENGTH('dbo.members', 'date_of_birth') IS NULL
    ALTER TABLE dbo.members ADD date_of_birth DATE NULL;
GO

IF COL_LENGTH('dbo.members', 'first_name') IS NULL
    ALTER TABLE dbo.members ADD first_name NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.members', 'last_name') IS NULL
    ALTER TABLE dbo.members ADD last_name NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.members', 'middle_initial') IS NULL
    ALTER TABLE dbo.members ADD middle_initial NVARCHAR(5) NOT NULL CONSTRAINT DF_members_middle_initial DEFAULT N'';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_members_name_parts' AND object_id=OBJECT_ID(N'dbo.members'))
    CREATE UNIQUE INDEX UX_members_name_parts ON dbo.members(first_name, last_name, middle_initial)
    WHERE first_name IS NOT NULL AND last_name IS NOT NULL AND deleted_at IS NULL;
GO




IF OBJECT_ID(N'dbo.password_reset_otps', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.password_reset_otps (
        id INT IDENTITY(1,1) PRIMARY KEY,
        memberID INT NOT NULL,
        email NVARCHAR(255) NOT NULL,
        otp_hash NVARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        verified_at DATETIME NULL,
        reset_token_hash CHAR(64) NULL,
        reset_expires_at DATETIME NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_password_reset_member FOREIGN KEY (memberID) REFERENCES dbo.members(memberID)
    );

    CREATE INDEX IX_password_reset_email_created
        ON dbo.password_reset_otps(email, created_at DESC);
END
GO




IF OBJECT_ID(N'dbo.attendance_records', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.attendance_records (
        id INT IDENTITY(1,1) PRIMARY KEY,
        member_id INT NULL,
        walk_in_id INT NULL,
        payment_method NVARCHAR(20) NOT NULL,
        sessions NVARCHAR(255) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        attendance_date DATETIME NOT NULL DEFAULT GETDATE(),
        payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',
        CONSTRAINT FK_attendance_members FOREIGN KEY (member_id) REFERENCES dbo.members(memberID)
    );
END
GO




IF OBJECT_ID(N'dbo.trainer_sessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.trainer_sessions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainer_id INT NULL,
        session_type NVARCHAR(100) NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        rating DECIMAL(3,1) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_notes VARCHAR(500) NULL,
        rated_by VARCHAR(100) NULL,
        is_booked BIT NOT NULL DEFAULT 0,
        is_paid BIT NOT NULL DEFAULT 0,
        booked_by VARCHAR(50) NULL,
        booked_at DATETIME NULL,
        booked_by_name VARCHAR(100) NULL,
        CONSTRAINT FK_sessions_trainers FOREIGN KEY (trainer_id) REFERENCES dbo.trainers(trainerID)
    );
END
GO





IF OBJECT_ID(N'dbo.payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.payments (
        payment_id INT IDENTITY(1,1) PRIMARY KEY,
        member_id INT NOT NULL,
        payment_type VARCHAR(30) NOT NULL,
        attendance_id INT NULL,
        session_id INT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method NVARCHAR(30) NOT NULL,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        confirmed_at DATETIME NULL,
        confirmed_by INT NULL,
        rejection_reason NVARCHAR(500) NULL,
        payment_date DATETIME NOT NULL DEFAULT GETDATE(),
        recorded_by INT NULL,
        notes NVARCHAR(500) NULL,
        CONSTRAINT CK_payments_amount CHECK (amount > 0),
        CONSTRAINT CK_payments_type CHECK (payment_type IN ('REGULAR_SESSION','TRAINER_SESSION','MEMBERSHIP','PROMOTION')),
        CONSTRAINT CK_payments_status CHECK (payment_status IN ('pending','paid','billed','rejected','voided','refunded')),
        CONSTRAINT FK_payments_member FOREIGN KEY (member_id) REFERENCES dbo.members(memberID),
        CONSTRAINT FK_payments_attendance FOREIGN KEY (attendance_id) REFERENCES dbo.attendance_records(id),
        CONSTRAINT FK_payments_session FOREIGN KEY (session_id) REFERENCES dbo.trainer_sessions(id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_payments_date_status' AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    CREATE INDEX IX_payments_date_status ON dbo.payments(payment_date, payment_status);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_payments_member' AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    CREATE INDEX IX_payments_member ON dbo.payments(member_id, payment_date);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_paid_session' AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    CREATE UNIQUE INDEX UX_payments_paid_session
        ON dbo.payments(member_id, session_id)
        WHERE session_id IS NOT NULL AND payment_type = 'TRAINER_SESSION' AND payment_status IN ('pending','paid');
END
GO





IF OBJECT_ID(N'dbo.member_session_enrollments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.member_session_enrollments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        member_id INT NOT NULL,
        session_id INT NOT NULL,
        enrolled_at DATETIME NULL,
        booking_date DATETIME NOT NULL DEFAULT GETDATE(),
        status VARCHAR(20) NULL,
        CONSTRAINT FK_enrollments_members FOREIGN KEY (member_id) REFERENCES dbo.members(memberID),
        CONSTRAINT FK_enrollments_sessions FOREIGN KEY (session_id) REFERENCES dbo.trainer_sessions(id),
        CONSTRAINT UQ_member_session UNIQUE(member_id, session_id)
    );
END
GO




IF OBJECT_ID(N'dbo.member_session_ratings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.member_session_ratings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        member_id INT NOT NULL,
        session_id INT NOT NULL,
        rating TINYINT NOT NULL,
        rated_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT CK_member_session_ratings_rating CHECK (rating BETWEEN 1 AND 5),
        CONSTRAINT UQ_member_session_ratings_member_session UNIQUE (member_id, session_id),
        CONSTRAINT FK_member_session_ratings_member FOREIGN KEY (member_id) REFERENCES dbo.members(memberID),
        CONSTRAINT FK_member_session_ratings_session FOREIGN KEY (session_id) REFERENCES dbo.trainer_sessions(id)
    );
END
GO

INSERT INTO dbo.member_session_ratings (member_id, session_id, rating)
SELECT m.memberID, ts.id, CONVERT(TINYINT, ts.rating)
FROM dbo.trainer_sessions ts
INNER JOIN dbo.members m
    ON LOWER(LTRIM(RTRIM(m.full_name))) = LOWER(LTRIM(RTRIM(ts.rated_by)))
WHERE ts.rating BETWEEN 1 AND 5
  AND ts.rated_by IS NOT NULL
  AND (SELECT COUNT(*) FROM dbo.members mx
       WHERE LOWER(LTRIM(RTRIM(mx.full_name))) = LOWER(LTRIM(RTRIM(ts.rated_by)))) = 1
  AND NOT EXISTS (
      SELECT 1 FROM dbo.member_session_ratings existing
      WHERE existing.member_id = m.memberID AND existing.session_id = ts.id
  );
GO

IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        type NVARCHAR(50) NOT NULL DEFAULT 'info',
        role NVARCHAR(50) NULL,
        is_read BIT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

IF COL_LENGTH('dbo.notifications', 'role') IS NULL
BEGIN
    ALTER TABLE dbo.notifications ADD role NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.notifications', 'is_read') IS NULL
BEGIN
    ALTER TABLE dbo.notifications ADD is_read BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.notifications', 'created_at') IS NULL
BEGIN
    ALTER TABLE dbo.notifications ADD created_at DATETIME NOT NULL DEFAULT GETDATE();
END
GO




IF OBJECT_ID(N'dbo.gym_settings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.gym_settings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        gym_name NVARCHAR(255) NOT NULL,
        gym_address NVARCHAR(255) NOT NULL,
        gym_phone NVARCHAR(255) NOT NULL,
        gym_email NVARCHAR(255) NOT NULL,
        gym_website NVARCHAR(255) NOT NULL,
        logo_url NVARCHAR(255) NULL,
        primary_color NVARCHAR(255) NOT NULL,
        secondary_color NVARCHAR(255) NOT NULL,
        accent_color NVARCHAR(255) NOT NULL,
        text_color NVARCHAR(255) NOT NULL,
        background_color NVARCHAR(255) NOT NULL,
        updated_at DATETIME NULL
    );
END
GO




IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(50) NULL,
        status NVARCHAR(50) NULL,
        created_at DATETIME NULL DEFAULT GETDATE()
    );
END
GO




IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_admin_staff_email' AND object_id = OBJECT_ID(N'dbo.admin_staff'))
BEGIN
    CREATE INDEX IX_admin_staff_email ON dbo.admin_staff(email);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_trainers_email' AND object_id = OBJECT_ID(N'dbo.trainers'))
BEGIN
    CREATE INDEX IX_trainers_email ON dbo.trainers(email);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_members_email' AND object_id = OBJECT_ID(N'dbo.members'))
BEGIN
    CREATE INDEX IX_members_email ON dbo.members(email);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_users_email' AND object_id = OBJECT_ID(N'dbo.users'))
BEGIN
    CREATE INDEX IX_users_email ON dbo.users(email);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_attendance_member_date' AND object_id = OBJECT_ID(N'dbo.attendance_records'))
BEGIN
    CREATE INDEX IX_attendance_member_date ON dbo.attendance_records(member_id, attendance_date);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sessions_status_date' AND object_id = OBJECT_ID(N'dbo.trainer_sessions'))
BEGIN
    CREATE INDEX IX_sessions_status_date ON dbo.trainer_sessions(status, start_time);
END
GO




IF NOT EXISTS (SELECT 1 FROM dbo.admin_staff WHERE email = N'admin@gym.com')
BEGIN
    INSERT INTO dbo.admin_staff (full_name, email, phone_number, age, role, status, password)
    VALUES (N'Admin User', N'admin@gym.com', N'09123456789', 30, N'admin', N'active', N'$2y$12$8242fxGZLKnBthgN05JYCOLhEU.25uI8nmotI7WfCz5eGjCSiocli');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.trainers WHERE email = N'trainer@gym.com')
BEGIN
    INSERT INTO dbo.trainers (full_name, email, phone_number, age, role, expertise_area, status, password)
    VALUES (N'Trainer User', N'trainer@gym.com', N'09123456790', 28, N'trainer', N'Weight Training', N'Active', N'$2y$12$6Du6LR4XI7VrxUrEt8wEQulLDggc0iI8Uf4WsrMSAOoag9Nd39hcG');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = N'user@gym.com')
BEGIN
    INSERT INTO dbo.users (full_name, email, password_hash, role, status, created_at)
    VALUES (N'System User', N'user@gym.com', N'$2y$12$mv3miJMSI75BPC2XRXFO4.CIYyLAUiS2Tv3hZ4tdYV4qxOEgGfX16', N'admin', N'active', GETDATE());
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.gym_settings)
BEGIN
    INSERT INTO dbo.gym_settings (gym_name, gym_address, gym_phone, gym_email, gym_website, primary_color, secondary_color, accent_color, text_color, background_color)
    VALUES (N'Capra Fitness', N'123 Main Street, City', N'09123456789', N'info@caprafitness.com', N'https://caprafitness.com', N'#D9A75B', N'#0A0A0A', N'#F5E6B3', N'#FFFFFF', N'#0A0A0A');
END
GO

PRINT 'Gym database schema setup completed successfully.';
GO





IF OBJECT_ID(N'dbo.gym_session_types', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.gym_session_types (
        id INT IDENTITY(1,1) PRIMARY KEY,
        session_name NVARCHAR(100) NOT NULL UNIQUE,
        price DECIMAL(10,2) NOT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        image_url NVARCHAR(500) NULL,
        CONSTRAINT CK_gym_session_types_price CHECK (price >= 0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Regular Session')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Regular Session', 50.00);
IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Weight Lifting')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Weight Lifting', 200.00);
IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Boxing')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Boxing', 200.00);
IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Personal Trainer')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Personal Trainer', 200.00);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Pickleball')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Pickleball', 200.00);
GO







USE [GymDB];
GO














IF OBJECT_ID(N'dbo.payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.payments (
        payment_id INT IDENTITY(1,1) PRIMARY KEY,
        member_id INT NOT NULL,
        payment_type VARCHAR(30) NOT NULL,
        attendance_id INT NULL,
        session_id INT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method NVARCHAR(30) NOT NULL,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',
        payment_date DATETIME NOT NULL DEFAULT GETDATE(),
        recorded_by INT NULL,
        notes NVARCHAR(500) NULL,
        CONSTRAINT CK_payments_amount CHECK (amount > 0),
        CONSTRAINT CK_payments_type CHECK (payment_type IN ('REGULAR_SESSION','TRAINER_SESSION','MEMBERSHIP','PROMOTION')),
        CONSTRAINT CK_payments_status CHECK (payment_status IN ('paid','voided','refunded')),
        CONSTRAINT FK_payments_member FOREIGN KEY (member_id) REFERENCES dbo.members(memberID),
        CONSTRAINT FK_payments_attendance FOREIGN KEY (attendance_id) REFERENCES dbo.attendance_records(id),
        CONSTRAINT FK_payments_session FOREIGN KEY (session_id) REFERENCES dbo.trainer_sessions(id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_payments_date_status' AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    CREATE INDEX IX_payments_date_status ON dbo.payments(payment_date, payment_status);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_payments_member' AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    CREATE INDEX IX_payments_member ON dbo.payments(member_id, payment_date);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_paid_session' AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    CREATE UNIQUE INDEX UX_payments_paid_session
        ON dbo.payments(member_id, session_id)
        WHERE session_id IS NOT NULL AND payment_type = 'TRAINER_SESSION' AND payment_status = 'paid';
END
GO


INSERT INTO dbo.payments
    (member_id, payment_type, attendance_id, session_id, amount, payment_method, payment_status, payment_date, notes)
SELECT
    ar.member_id,
    CASE
        WHEN ar.sessions LIKE '%Trainer%' OR ar.sessions LIKE '%trainer%' THEN 'REGULAR_SESSION'
        ELSE 'REGULAR_SESSION'
    END,
    ar.id,
    NULL,
    ar.total_amount,
    ar.payment_method,
    'paid',
    ar.attendance_date,
    N'Backfilled from legacy attendance_records'
FROM dbo.attendance_records ar
WHERE ar.total_amount > 0
  AND NOT EXISTS (
      SELECT 1 FROM dbo.payments p WHERE p.attendance_id = ar.id
  );
GO

SELECT
    COUNT(*) AS payment_rows,
    COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) AS paid_revenue
FROM dbo.payments;
GO








USE [GymDB];
GO

IF COL_LENGTH('dbo.attendance_records', 'payment_status') IS NULL
BEGIN
    ALTER TABLE dbo.attendance_records ADD payment_status VARCHAR(20) NOT NULL CONSTRAINT DF_attendance_payment_status DEFAULT 'paid';
END
GO

IF COL_LENGTH('dbo.payments', 'created_at') IS NULL
BEGIN
    ALTER TABLE dbo.payments ADD created_at DATETIME NOT NULL CONSTRAINT DF_payments_created_at DEFAULT GETDATE();
END
GO
IF COL_LENGTH('dbo.payments', 'confirmed_at') IS NULL
BEGIN
    ALTER TABLE dbo.payments ADD confirmed_at DATETIME NULL;
END
GO
IF COL_LENGTH('dbo.payments', 'confirmed_by') IS NULL
BEGIN
    ALTER TABLE dbo.payments ADD confirmed_by INT NULL;
END
GO
IF COL_LENGTH('dbo.payments', 'rejection_reason') IS NULL
BEGIN
    ALTER TABLE dbo.payments ADD rejection_reason NVARCHAR(500) NULL;
END
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_payments_status' AND parent_object_id = OBJECT_ID(N'dbo.payments'))
    ALTER TABLE dbo.payments DROP CONSTRAINT CK_payments_status;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_payments_status' AND parent_object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    ALTER TABLE dbo.payments WITH CHECK ADD CONSTRAINT CK_payments_status CHECK (payment_status IN ('pending','paid','billed','rejected','voided','refunded'));
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name IN (N'UX_payments_paid_session', N'UX_payments_active_session', N'UX_payments_active_member_session') AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_paid_session' AND object_id = OBJECT_ID(N'dbo.payments'))
        DROP INDEX UX_payments_paid_session ON dbo.payments;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_active_session' AND object_id = OBJECT_ID(N'dbo.payments'))
        DROP INDEX UX_payments_active_session ON dbo.payments;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_active_member_session' AND object_id = OBJECT_ID(N'dbo.payments'))
        DROP INDEX UX_payments_active_member_session ON dbo.payments;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_active_member_session' AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    CREATE UNIQUE INDEX UX_payments_active_member_session ON dbo.payments(member_id, session_id)
    WHERE session_id IS NOT NULL AND payment_type = 'TRAINER_SESSION' AND payment_status IN ('pending','paid');
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_payments_status_date' AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    CREATE INDEX IX_payments_status_date ON dbo.payments(payment_status, payment_date DESC);
END
GO











INSERT INTO dbo.payments
    (member_id, payment_type, session_id, amount, payment_method, payment_status, payment_date, notes)
SELECT
    mse.member_id,
    'TRAINER_SESSION',
    mse.session_id,
    ts.price,
    'Cash',
    'pending',
    COALESCE(mse.enrolled_at, mse.booking_date, GETDATE()),
    'Backfilled trainer session booking - awaiting admin payment confirmation'
FROM dbo.member_session_enrollments mse
INNER JOIN dbo.trainer_sessions ts ON ts.id = mse.session_id
WHERE mse.status IN ('booked', 'pending')
  AND ts.is_paid = 0
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.payments p
      WHERE p.member_id = mse.member_id
        AND p.session_id = mse.session_id
        AND p.payment_type = 'TRAINER_SESSION'
        AND p.payment_status IN ('pending', 'paid')
  );
GO
















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

IF OBJECT_ID(N'dbo.billing_records', N'U') IS NULL
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

IF COL_LENGTH('dbo.billing_records', 'bill_id') IS NOT NULL
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

PRINT 'Invoice billing schema created successfully.';
GO












IF OBJECT_ID(N'dbo.gym_session_types', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.gym_session_types (
        id INT IDENTITY(1,1) PRIMARY KEY,
        session_name NVARCHAR(100) NOT NULL UNIQUE,
        price DECIMAL(10,2) NOT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        image_url NVARCHAR(500) NULL,
        CONSTRAINT CK_gym_session_types_price CHECK (price >= 0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Regular Session')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Regular Session', 50.00);
IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Weight Lifting')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Weight Lifting', 200.00);
IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Boxing')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Boxing', 200.00);
IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Personal Trainer')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Personal Trainer', 200.00);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Pickleball')
    INSERT INTO dbo.gym_session_types (session_name, price) VALUES (N'Pickleball', 200.00);
GO











IF OBJECT_ID(N'dbo.gym_session_types', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.gym_session_types (
        id INT IDENTITY(1,1) PRIMARY KEY,
        session_name NVARCHAR(100) NOT NULL UNIQUE,
        price DECIMAL(10,2) NOT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        image_url NVARCHAR(500) NULL,
        CONSTRAINT CK_gym_session_types_price CHECK (price >= 0)
    );
END
GO


IF COL_LENGTH('dbo.gym_session_types', 'is_active') IS NULL
BEGIN
    ALTER TABLE dbo.gym_session_types ADD is_active BIT NOT NULL CONSTRAINT DF_gym_session_types_is_active DEFAULT 1;
END
GO

IF COL_LENGTH('dbo.gym_session_types', 'updated_at') IS NULL
BEGIN
    ALTER TABLE dbo.gym_session_types ADD updated_at DATETIME NOT NULL CONSTRAINT DF_gym_session_types_updated_at DEFAULT GETDATE();
END
GO


