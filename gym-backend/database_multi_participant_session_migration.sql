USE [GymDB];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_paid_session' AND object_id = OBJECT_ID(N'dbo.payments'))
    DROP INDEX UX_payments_paid_session ON dbo.payments;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_active_session' AND object_id = OBJECT_ID(N'dbo.payments'))
    DROP INDEX UX_payments_active_session ON dbo.payments;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_active_member_session' AND object_id = OBJECT_ID(N'dbo.payments'))
BEGIN
    CREATE UNIQUE INDEX UX_payments_active_member_session
        ON dbo.payments(member_id, session_id)
        WHERE session_id IS NOT NULL
          AND payment_type = 'TRAINER_SESSION'
          AND payment_status IN ('pending', 'paid');
END
GO