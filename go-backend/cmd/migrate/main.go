package main

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "modernc.org/sqlite"
)

func main() {
	dbPath := filepath.Join("data", "sekolahku.db")
	
	// Ensure data directory exists
	if _, err := os.Stat("data"); os.IsNotExist(err) {
		os.Mkdir("data", 0755)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal("Gagal membuka database:", err)
	}
	defer db.Close()

	// 1. Create migration tracking table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)`)
	if err != nil {
		log.Fatal("Gagal membuat tabel tracking migrasi:", err)
	}

	// 2. Read migration files
	migrationDir := filepath.Join("go-backend", "internal", "db", "migrations")
	files, err := ioutil.ReadDir(migrationDir)
	if err != nil {
		log.Fatal("Gagal membaca folder migrasi:", err)
	}

	var upFiles []string
	for _, f := range files {
		if strings.HasSuffix(f.Name(), ".up.sql") {
			upFiles = append(upFiles, f.Name())
		}
	}
	sort.Strings(upFiles)

	// 3. Apply migrations
	for _, fName := range upFiles {
		version := 0
		fmt.Sscanf(fName, "%d_", &version)

		// Check if already applied
		var exists int
		err = db.QueryRow("SELECT COUNT(*) FROM _migrations WHERE version = ?", version).Scan(&exists)
		if err != nil {
			log.Fatal(err)
		}

		if exists > 0 {
			fmt.Printf("[SKIP] %s (Sudah diterapkan)\n", fName)
			continue
		}

		fmt.Printf("[APPLYING] %s...\n", fName)
		content, err := ioutil.ReadFile(filepath.Join(migrationDir, fName))
		if err != nil {
			log.Fatal(err)
		}

		// Execute SQL
		_, err = db.Exec(string(content))
		if err != nil {
			log.Fatalf("Gagal menjalankan migrasi %s: %v", fName, err)
		}

		// Record success
		_, err = db.Exec("INSERT INTO _migrations (version) VALUES (?)", version)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("[SUCCESS] %s berhasil diterapkan.\n", fName)
	}

	fmt.Println("\nSemua migrasi selesai diterapkan.")
}
