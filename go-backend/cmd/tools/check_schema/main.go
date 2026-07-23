package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "sekolahku.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT sql FROM sqlite_master WHERE type='table' AND (name='letter_templates' OR name='surat_keluar')")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var schema string
		if err := rows.Scan(&schema); err != nil {
			log.Fatal(err)
		}
		fmt.Println(schema)
	}
}
