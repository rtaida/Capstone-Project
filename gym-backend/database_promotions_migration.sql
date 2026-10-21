USE [GymDB];
GO

IF OBJECT_ID(N'dbo.promotions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.promotions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        promo_name NVARCHAR(150) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        duration_days INT NOT NULL DEFAULT 30,
        availment_deadline DATE NOT NULL,
        image_url NVARCHAR(500) NULL,
        is_active BIT NOT NULL CONSTRAINT DF_promotions_is_active DEFAULT 1,
        created_at DATETIME NOT NULL CONSTRAINT DF_promotions_created_at DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL CONSTRAINT DF_promotions_updated_at DEFAULT GETDATE(),
        CONSTRAINT CK_promotions_price CHECK (price >= 0),
        CONSTRAINT CK_promotions_duration CHECK (duration_days > 0)
    );
END;
GO

IF COL_LENGTH('dbo.promotions', 'duration_days') IS NULL
BEGIN
    ALTER TABLE dbo.promotions ADD duration_days INT NOT NULL CONSTRAINT DF_promotions_duration_days DEFAULT 30;
END;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_promotions_availability_dates' AND parent_object_id = OBJECT_ID(N'dbo.promotions'))
    ALTER TABLE dbo.promotions DROP CONSTRAINT CK_promotions_availability_dates;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_promotions_deadline_date' AND parent_object_id = OBJECT_ID(N'dbo.promotions'))
    ALTER TABLE dbo.promotions DROP CONSTRAINT CK_promotions_deadline_date;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_promotions_expiration_date' AND parent_object_id = OBJECT_ID(N'dbo.promotions'))
    ALTER TABLE dbo.promotions DROP CONSTRAINT CK_promotions_expiration_date;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_promotions_duration' AND parent_object_id = OBJECT_ID(N'dbo.promotions'))
    ALTER TABLE dbo.promotions ADD CONSTRAINT CK_promotions_duration CHECK (duration_days > 0);
GO

IF COL_LENGTH('dbo.promotions', 'availability_start') IS NOT NULL
    ALTER TABLE dbo.promotions ALTER COLUMN availability_start DATE NULL;
IF COL_LENGTH('dbo.promotions', 'availability_end') IS NOT NULL
    ALTER TABLE dbo.promotions ALTER COLUMN availability_end DATE NULL;
IF COL_LENGTH('dbo.promotions', 'expiration_date') IS NOT NULL
    ALTER TABLE dbo.promotions ALTER COLUMN expiration_date DATE NULL;
GO

IF OBJECT_ID(N'dbo.promo_availments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.promo_availments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        promo_id INT NOT NULL,
        member_id INT NOT NULL,
        availed_at DATETIME NULL DEFAULT GETDATE(),
        expiration_date DATE NULL,
        payment_id INT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        CONSTRAINT UQ_promo_availment_member UNIQUE (promo_id, member_id),
        CONSTRAINT FK_promo_availments_promo FOREIGN KEY (promo_id) REFERENCES dbo.promotions(id),
        CONSTRAINT FK_promo_availments_member FOREIGN KEY (member_id) REFERENCES dbo.members(memberID)
    );
END;
GO

IF COL_LENGTH('dbo.promo_availments', 'availed_at') IS NOT NULL
    ALTER TABLE dbo.promo_availments ALTER COLUMN availed_at DATETIME NULL;
GO

IF COL_LENGTH('dbo.promo_availments', 'payment_id') IS NULL
    ALTER TABLE dbo.promo_availments ADD payment_id INT NULL;
IF COL_LENGTH('dbo.promo_availments', 'expiration_date') IS NOT NULL
    ALTER TABLE dbo.promo_availments ALTER COLUMN expiration_date DATE NULL;
GO

UPDATE pa
SET pa.payment_id = p.payment_id
FROM dbo.promo_availments pa
INNER JOIN dbo.promotions pr ON pr.id = pa.promo_id
INNER JOIN dbo.payments p ON p.member_id = pa.member_id
    AND p.payment_type = 'PROMOTION'
    AND p.notes LIKE '%Promo ID: ' + CAST(pr.id AS VARCHAR(20)) + ' -%'
WHERE pa.payment_id IS NULL;

UPDATE pa
SET pa.status = CASE WHEN p.payment_status = 'paid' THEN 'active' ELSE 'pending' END
FROM dbo.promo_availments pa
INNER JOIN dbo.payments p ON p.payment_id = pa.payment_id;

UPDATE pa
SET pa.expiration_date = DATEADD(DAY, pr.duration_days, CONVERT(date, pa.availed_at))
FROM dbo.promo_availments pa
INNER JOIN dbo.promotions pr ON pr.id = pa.promo_id
WHERE pa.status = 'active' AND pa.availed_at IS NOT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_payments_type' AND parent_object_id = OBJECT_ID(N'dbo.payments'))
    ALTER TABLE dbo.payments DROP CONSTRAINT CK_payments_type;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_payments_type' AND parent_object_id = OBJECT_ID(N'dbo.payments'))
    ALTER TABLE dbo.payments ADD CONSTRAINT CK_payments_type CHECK (payment_type IN ('REGULAR_SESSION','TRAINER_SESSION','MEMBERSHIP','PROMOTION'));
GO
