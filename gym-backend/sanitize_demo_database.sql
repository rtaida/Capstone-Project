IF DB_NAME() <> N'GymDBDemo'
BEGIN
    THROW 50000, 'This script is restricted to the GymDBDemo database.', 1;
END;

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
BEGIN TRANSACTION;
DECLARE @DisabledPasswordHash nvarchar(255) =
    N'$2y$10$T8X5isfUZ3Rd1f4zPJNPW.h2NIoPMQXwLvscob1IVz5yKIbEZfYrK';

UPDATE dbo.trainer_sessions
SET rated_by = CONCAT(N'Demo Member ', member.memberID)
FROM dbo.trainer_sessions AS ts
JOIN dbo.members AS member
    ON LOWER(LTRIM(RTRIM(ts.rated_by))) = LOWER(LTRIM(RTRIM(member.full_name)))
WHERE ts.rated_by IS NOT NULL;

UPDATE dbo.members
SET full_name = CONCAT(N'Demo Member ', memberID),
    first_name = N'Demo',
    last_name = CONCAT(N'Member', memberID),
    middle_initial = N'X',
    email = CONCAT(N'member', memberID, N'@example.invalid'),
    phone = NULL,
    weight = NULL,
    height = NULL,
    age = 30,
    gender = NULL,
    password = @DisabledPasswordHash,
    qr_code = NULL,
    admin_notes = NULL,
    profile_photo = NULL,
    date_of_birth = NULL;

UPDATE dbo.admin_staff
SET full_name = CONCAT(N'Demo Staff ', adminID),
    email = CONCAT(N'staff', adminID, N'@example.invalid'),
    phone_number = CONCAT(N'000-000-', RIGHT(CONCAT(N'0000', adminID), 4)),
    password = @DisabledPasswordHash,
    profile_photo = NULL;

UPDATE dbo.trainers
SET full_name = CONCAT(N'Demo Trainer ', trainerID),
    email = CONCAT(N'trainer', trainerID, N'@example.invalid'),
    phone_number = CONCAT(N'000-001-', RIGHT(CONCAT(N'0000', trainerID), 4)),
    expertise_area = N'Demo coaching',
    password = @DisabledPasswordHash,
    profile_photo = NULL;

UPDATE dbo.users
SET full_name = CONCAT(N'Demo User ', id),
    email = CONCAT(N'user', id, N'@example.invalid'),
    password_hash = @DisabledPasswordHash;

UPDATE dbo.walk_in_records
SET client_name = CONCAT(N'Demo Walk-in ', id),
    emergency_contact = NULL,
    email = CONCAT(N'walkin', id, N'@example.invalid'),
    rejection_reason = NULL;

UPDATE dbo.gym_settings
SET gym_address = N'Demo location',
    gym_phone = N'000-000-0000',
    gym_email = N'demo@example.invalid',
    gym_website = N'https://example.invalid',
    logo_url = NULL;

UPDATE dbo.trainer_sessions
SET admin_notes = NULL,
    booked_by = NULL,
    booked_by_name = CASE WHEN is_booked = 1 THEN N'Demo Member' ELSE NULL END;

UPDATE dbo.bill_details
SET description = N'Demo billing record';

UPDATE dbo.billing_records_legacy_migrated
SET notes = NULL;

UPDATE dbo.payments
SET rejection_reason = NULL,
    notes = NULL;

DELETE FROM dbo.audit_trail;
DELETE FROM dbo.notifications;
DELETE FROM dbo.password_reset_otps;
DELETE FROM dbo.login_rate_limits;
DELETE FROM dbo.session_reminder_log;

COMMIT TRANSACTION;
