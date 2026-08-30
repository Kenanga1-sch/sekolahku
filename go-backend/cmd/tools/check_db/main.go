package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "d:/antigravity/sekolahku/data/sekolahku.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	printCounts := func(title string, query string) {
		fmt.Println("---", title, "---")
		rows, err := db.Query(query)
		if err != nil {
			log.Printf("Error running query: %v", err)
			return
		}
		defer rows.Close()

		for rows.Next() {
			var count int
			var val1, val2 sql.NullString
			err = rows.Scan(&count, &val1, &val2)
			if err != nil {
				err2 := rows.Scan(&count, &val1)
				if err2 != nil {
					rows.Scan(&count)
					fmt.Printf("Count: %d\n", count)
				} else {
					fmt.Printf("Count: %d | Val: %s\n", count, val1.String)
				}
			} else {
				fmt.Printf("Count: %d | Val1: %s | Val2: %s\n", count, val1.String, val2.String)
			}
		}
	}

	printCounts("Students by is_active and status", "SELECT COUNT(*), CAST(is_active AS TEXT), COALESCE(status, '') FROM students GROUP BY is_active, status")
	printCounts("Library Members by is_active and linked status", `
		SELECT COUNT(*), CAST(m.is_active AS TEXT),
		       CAST((CASE WHEN m.student_id IS NOT NULL AND m.student_id != '' THEN 1 ELSE 0 END) AS TEXT)
		FROM library_members m
		GROUP BY m.is_active, (m.student_id IS NOT NULL AND m.student_id != '')
	`)
	printCounts("Savings by linked & student active status", `
		SELECT COUNT(*), CAST(ts.student_id IS NOT NULL AS TEXT),
		       COALESCE(st.status, 'no-student')
		FROM tabungan_siswa ts
		LEFT JOIN students st ON ts.student_id = st.id
		GROUP BY (ts.student_id IS NOT NULL), st.status
	`)
}
