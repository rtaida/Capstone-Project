USE [GymDB];
GO

IF OBJECT_ID(N'dbo.audit_trail', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.audit_trail (
        id INT IDENTITY(1,1) PRIMARY KEY,
        actor_id INT NULL,
        actor_name NVARCHAR(255) NULL,
        position NVARCHAR(50) NULL,
        action NVARCHAR(255) NULL,
        action_type NVARCHAR(20) NOT NULL,
        error_part NVARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_audit_trail_created_at ON dbo.audit_trail(created_at DESC);
    CREATE INDEX IX_audit_trail_action_type ON dbo.audit_trail(action_type, created_at DESC);
END
GO