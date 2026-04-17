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

	rowsList, err := db.Query("SELECT id, email, role FROM users")
	if err == nil {
		fmt.Println("Users in DB:")
		for rowsList.Next() {
			var id, email, role string
			rowsList.Scan(&id, &email, &role)
			fmt.Printf("- %s: %s (%s)\n", id, email, role)
		}
		rowsList.Close()
	}

	result, err := db.Exec("UPDATE users SET role = 'admin' WHERE role = 'superadmin' OR role = 'SuperAdmin'")
	if err != nil {
		log.Fatal(err)
	}

	rows, _ := result.RowsAffected()
	fmt.Printf("Updated %d users from superadmin to admin\n", rows)
}
