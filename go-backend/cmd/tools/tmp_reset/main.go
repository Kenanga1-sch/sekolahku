package main

import (
	"database/sql"
	"fmt"

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

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
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
	fmt.Printf("Updated %d admin row(s). Password reset to admin123, must_change_password=1\n", n)
}
