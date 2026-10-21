

IF COL_LENGTH('dbo.notifications', 'recipient_id') IS NULL
BEGIN
    ALTER TABLE dbo.notifications ADD recipient_id INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_notifications_recipient'
      AND object_id = OBJECT_ID('dbo.notifications')
)
BEGIN
    CREATE INDEX IX_notifications_recipient
    ON dbo.notifications(role, recipient_id, is_read, created_at);
END
GO
