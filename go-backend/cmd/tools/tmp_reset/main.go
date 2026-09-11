package main

import (
	"database/sql"
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "data/sekolahku.db")
	if err != nil {
		fmt.Println("err:", err)
		return
	}
	defer db.Close()

	newPassword := os.Getenv("ADMIN_PASSWORD")
	if newPassword == "" {
		fmt.Println("Set ADMIN_PASSWORD terlebih dahulu.")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println("hash err:", err)
		return
	}

	res, err := db.Exec("UPDATE users SET password_hash = ?, must_change_password = 1, is_active = 1 WHERE email = ?", string(hash), "admin@sekolah.sch.id")
	if err != nil {
		fmt.Println("update err:", err)
		return
	}
	n, _ := res.RowsAffected()
	fmt.Printf("Updated %d admin row(s). Password direset, must_change_password=1\n", n)
}
