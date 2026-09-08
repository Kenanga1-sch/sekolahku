package repository

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sekolahku/go-backend/internal/db/migrations"
	_ "modernc.org/sqlite"
)

// applyMigrationFile menjalankan satu file .up.sql, memisah pernyataan per
// titik-koma. Sama seperti runner produksi.
func applyMigrationFile(t *testing.T, db *sql.DB, name string) {
	t.Helper()
	path := filepath.Join("..", "db", "migrations", name)
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}

	var stmts []string
	var cur string
	for _, line := range strings.Split(string(raw), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			continue
		}
		cur += line + "\n"
		if strings.HasSuffix(trimmed, ";") {
			stmts = append(stmts, cur)
			cur = ""
		}
	}
	if strings.TrimSpace(cur) != "" {
		stmts = append(stmts, cur)
	}

	for _, stmt := range stmts {
		if strings.TrimSpace(stmt) == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("%s: %v\nSQL: %s", name, err, stmt)
		}
	}
}

// setupInventorySchemaFromMigrations membangun skema inventaris DARI FILE
// MIGRASI ASLI, bukan dari DDL yang ditulis ulang di test.
//
// Alasannya: selama fixture test menyalin skema secara manual, kode repository
// dan skema produksi bisa melenceng tanpa ada test yang menangkap. Test ini
// sekarang gagal kalau migrasi berubah tanpa menyesuaikan kodenya.
func setupInventorySchemaFromMigrations(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	// users adalah tabel baseline dari createCoreTables, bukan bagian dari
	// migrasi inventaris, jadi dibuat di sini secukupnya.
	if _, err := db.Exec(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT)`); err != nil {
		t.Fatalf("users: %v", err)
	}

	applyMigrationFile(t, db, "000034_inventory_schema.up.sql")
	if err := migrations.MigrateInventoryData(db); err != nil {
		t.Fatalf("post-34: %v", err)
	}
	applyMigrationFile(t, db, "000035_inventory_item_room.up.sql")
	applyMigrationFile(t, db, "000036_inventory_label.up.sql")
	applyMigrationFile(t, db, "000037_inventory_item_batch.up.sql")

	return db
}
