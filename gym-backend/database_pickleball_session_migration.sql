USE [GymDB];
GO

IF COL_LENGTH(N'dbo.trainer_sessions', N'trainer_id') IS NOT NULL
   AND EXISTS (
       SELECT 1
       FROM sys.columns
       WHERE object_id = OBJECT_ID(N'dbo.trainer_sessions')
         AND name = N'trainer_id'
         AND is_nullable = 0
   )
BEGIN
    ALTER TABLE dbo.trainer_sessions ALTER COLUMN trainer_id INT NULL;
END
GO

IF OBJECT_ID(N'dbo.gym_session_types', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.gym_session_types WHERE session_name = N'Pickleball')
BEGIN
    INSERT INTO dbo.gym_session_types (session_name, price)
    VALUES (N'Pickleball', 200.00);
END
GO