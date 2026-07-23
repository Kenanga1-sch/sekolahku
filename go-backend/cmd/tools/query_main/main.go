package main

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "data/sekolahku.db")
	if err != nil {
		fmt.Println("Open error:", err)
		return
	}
	defer db.Close()

	rows, err := db.Query("SELECT * FROM employee_details LIMIT 1")
	if err != nil {
		fmt.Println("Query error:", err)
		return
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	fmt.Println("Columns:", cols)
	for rows.Next() {
		vals := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		rows.Scan(ptrs...)
		for i, col := range cols {
			fmt.Printf("%s: %v\n", col, vals[i])
		}
	}
}
