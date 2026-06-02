package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"
	_ "modernc.org/sqlite"
	"golang.org/x/crypto/bcrypt"
	"github.com/nrednav/cuid2"
)

func main() {
	dbPath := "../data/sekolahku.db"
	if len(os.Args) > 1 { dbPath = os.Args[1] }

	db, err := sql.Open("sqlite", dbPath)
	if err != nil { fmt.Println("DB error:", err); os.Exit(1) }
	defer db.Close()

	if err := db.Ping(); err != nil { fmt.Println("Ping error:", err); os.Exit(1) }

	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	_, err = db.Exec(`INSERT OR IGNORE INTO users (id, email, username, password_hash, role, name, full_name, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, "admin@sekolah.sch.id", "admin", string(hash), "superadmin", "Administrator", "Administrator Sekolah", now, now)
	if err != nil { fmt.Println("Insert error:", err); os.Exit(1) }

	fmt.Println("Admin user created!")
	fmt.Println("  Email: admin@sekolah.sch.id")
	fmt.Println("  Pass:  admin123")
}
