package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
	"github.com/sekolahku/go-backend/internal/repository"
)

func main() {
	db, err := sql.Open("sqlite", "d:/antigravity/sekolahku/go-backend/data/sekolahku.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	repo := repository.NewSavingsRepository(db)
	count, err := repo.SyncFromStudents()
	if err != nil {
		fmt.Printf("SyncFromStudents returned error: %v\n", err)
	} else {
		fmt.Printf("SyncFromStudents returned count: %d\n", count)
	}
}
