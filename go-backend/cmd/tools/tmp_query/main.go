package main

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "data/sekolahku.db")
	if err != nil {
		fmt.Println("err:", err)
		return
	}
	defer db.Close()
	rows, err := db.Query("SELECT id, email, username, name, role, substr(password_hash,1,25) as h, must_change_password FROM users")
	if err != nil {
		fmt.Println("qerr:", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id, email, username, name, role, hash string
		var mcp sql.NullInt64
		rows.Scan(&id, &email, &username, &name, &role, &hash, &mcp)
		fmt.Printf("email=%s user=%s name=%s role=%s hash=%s... mcp=%v\n", email, username, name, role, hash, mcp)
	}
}
