USE [GymDB];
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