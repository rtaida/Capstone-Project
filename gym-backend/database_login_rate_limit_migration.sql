USE [GymDB];
GO

IF OBJECT_ID('dbo.login_rate_limits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.login_rate_limits (
        rate_key VARCHAR(64) NOT NULL PRIMARY KEY,
        attempts INT NOT NULL DEFAULT 0,
        window_started DATETIME2 NOT NULL
    );
END;
GO
