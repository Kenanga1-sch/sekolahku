package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "modernc.org/sqlite"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: go run main.go <path-to-db>")
	}
	dbPath := os.Args[1]

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// 1. Get all alumni where status is graduated but graduation_year is empty
	rows, err := db.Query("SELECT id, student_id FROM alumni WHERE status = 'graduated' AND (graduation_year IS NULL OR graduation_year = '')")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, studentID sql.NullString
		if err := rows.Scan(&id, &studentID); err != nil {
			log.Fatal(err)
		}

		if studentID.Valid && studentID.String != "" {
			// Get graduation history
			var gradYear sql.NullString
			var className sql.NullString
			err = db.QueryRow("SELECT academic_year, class_name FROM student_class_history WHERE student_id = ? AND status = 'graduated' ORDER BY record_date DESC LIMIT 1", studentID.String).Scan(&gradYear, &className)
			if err == nil && gradYear.Valid {
				_, err = db.Exec("UPDATE alumni SET graduation_year = ?, final_class = ? WHERE id = ?", gradYear.String, className.String, id.String)
				if err == nil {
					count++
				}
			}
		}
	}
	fmt.Printf("Fixed %d graduated alumni records\n", count)
}
