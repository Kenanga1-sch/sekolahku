package main

import (
	"database/sql"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
	"os"
)

func main() {
	db, err := sql.Open("sqlite", "data/sekolahku.db")
	if err != nil {
		fmt.Println("err:", err)
		return
	}
	defer db.Close()

	var hash string
	err = db.QueryRow("SELECT password_hash FROM users WHERE email = 'admin@sekolah.sch.id'").Scan(&hash)
	if err != nil {
		fmt.Println("query err:", err)
		return
	}

	candidate := os.Getenv("ADMIN_PASSWORD")
	if candidate == "" {
		fmt.Println("Set ADMIN_PASSWORD terlebih dahulu.")
		return
	}
	err = bcrypt.CompareHashAndPassword([]byte(hash), []byte(candidate))
	if err != nil {
		fmt.Println("bcrypt compare:", err)
	} else {
		fmt.Println("password matches")
	}
}
