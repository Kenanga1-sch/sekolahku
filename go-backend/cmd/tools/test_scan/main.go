package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "data/sekolahku.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	classID := "hah1516t84ehrxvz97w6kdt0"
	query := `
		SELECT id, nik, nisn, nis, full_name, gender, class_name, status, photo, qr_code, is_active, created_at, kip
		FROM students
		WHERE 1=1 AND (status = 'active' OR is_active = 1) AND (class_id = ? OR class_name = ? OR class_name = (SELECT name FROM student_classes WHERE id = ?))
		ORDER BY full_name ASC
		LIMIT 2 OFFSET 0
	`

	rows, err := db.Query(query, classID, classID, classID)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var fullName string
		var nik, nisn, nis, gender, className, photo, qrCode, kip, status sql.NullString
		var isActive bool
		var crAtRaw interface{}

		err := rows.Scan(&id, &nik, &nisn, &nis, &fullName, &gender, &className, &status, &photo, &qrCode, &isActive, &crAtRaw, &kip)
		if err != nil {
			fmt.Println("SCAN ERROR:", err)
			continue
		}
		fmt.Printf("Scanned OK: %s, isActive: %v\n", fullName, isActive)
	}
	if err = rows.Err(); err != nil {
		fmt.Println("ROWS ERROR:", err)
	}
}
