package main

import (
	"database/sql"
	"fmt"
	"log"
	"path/filepath"

	_ "modernc.org/sqlite"
)

func main() {
	dbPath := filepath.Join("data", "sekolahku.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var sqlText string
		if err := rows.Scan(&sqlText); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%s;\n\n", sqlText)
	}

    // Also get indexes
    rowsIdx, err := db.Query("SELECT sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
    if err == nil {
        for rowsIdx.Next() {
            var sqlText string
            if err := rowsIdx.Scan(&sqlText); err != nil {
                continue
            }
            if sqlText != "" {
                fmt.Printf("%s;\n\n", sqlText)
            }
        }
        rowsIdx.Close()
    }
}
