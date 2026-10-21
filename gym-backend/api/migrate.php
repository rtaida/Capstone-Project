<?php


header('Content-Type: application/json');

try {
    $conn = new PDO(
        "odbc:Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=GymDB;Trusted_Connection=yes;TrustServerCertificate=yes;"
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    
    $checkSql = "SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'member_session_enrollments'";
    $checkStmt = $conn->query($checkSql);
    $tableExists = $checkStmt->rowCount() > 0;

    if ($tableExists) {
        echo json_encode([
            'success' => true,
            'message' => 'Table member_session_enrollments already exists',
            'created' => false
        ]);
    } else {
        
        $sql = "CREATE TABLE member_session_enrollments (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    member_id INT NOT NULL,
                    session_id INT NOT NULL,
                    booking_date DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (member_id) REFERENCES members(memberID),
                    FOREIGN KEY (session_id) REFERENCES trainer_sessions(id),
                    UNIQUE(member_id, session_id)
                )";
        
        $conn->exec($sql);

        echo json_encode([
            'success' => true,
            'message' => 'Table member_session_enrollments created successfully',
            'created' => true
        ]);
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>
