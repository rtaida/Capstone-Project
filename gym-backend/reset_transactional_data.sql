USE [GymDB];
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
    BEGIN TRANSACTION;

    DELETE FROM dbo.billing_records;
    IF OBJECT_ID(N'dbo.billing_records_legacy_migrated', N'U') IS NOT NULL
        DELETE FROM dbo.billing_records_legacy_migrated;
    DELETE FROM dbo.bill_details;
    DELETE FROM dbo.promo_availments;
    DELETE FROM dbo.member_session_enrollments;
    DELETE FROM dbo.payments;
    DELETE FROM dbo.attendance_records;
    DELETE FROM dbo.walk_in_records;
    DELETE FROM dbo.trainer_sessions;
    DELETE FROM dbo.notifications;
    IF OBJECT_ID(N'dbo.session_reminder_log', N'U') IS NOT NULL
        DELETE FROM dbo.session_reminder_log;
    DELETE FROM dbo.password_reset_otps;
    DELETE FROM dbo.login_rate_limits;
    DELETE FROM dbo.audit_trail;
    DELETE FROM dbo.promotions;
    DELETE FROM dbo.gym_settings;
    DELETE FROM dbo.users;

    DELETE FROM dbo.gym_session_types
    WHERE LOWER(LTRIM(RTRIM(session_name))) NOT IN (
        'regular session',
        'weight lifting',
        'boxing',
        'personal trainer'
    );

    DBCC CHECKIDENT ('dbo.bill_details', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.promo_availments', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.member_session_enrollments', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.payments', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.attendance_records', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.walk_in_records', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.trainer_sessions', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.notifications', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.password_reset_otps', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.audit_trail', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.promotions', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.gym_settings', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.users', RESEED, 0) WITH NO_INFOMSGS;

    COMMIT TRANSACTION;
    SELECT 'Transactional data reset completed successfully.' AS result;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
