USE [GymDB];
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