package repository

import (
	"database/sql"
	"fmt"
	"testing"

	_ "modernc.org/sqlite"
)

// setupOverdueTestDB menyiapkan skema secukupnya untuk laporan keterlambatan,
// lalu mengisi `count` pinjaman yang SUDAH lewat jatuh tempo dan belum
// dikembalikan.
func setupOverdueTestDB(t *testing.T, count int) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	if _, err := db.Exec(`
		CREATE TABLE library_catalog (
			id TEXT PRIMARY KEY, isbn TEXT, title TEXT, author TEXT, publisher TEXT,
			year TEXT, category TEXT, description TEXT, cover TEXT, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE library_assets (
			id TEXT PRIMARY KEY, catalog_id TEXT, status TEXT DEFAULT 'AVAILABLE',
			location TEXT, condition TEXT, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE library_members (
			id TEXT PRIMARY KEY, user_id TEXT, student_id TEXT,
			max_borrow_limit INTEGER DEFAULT 3, is_active INTEGER DEFAULT 1,
			created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE library_loans (
			id TEXT PRIMARY KEY, member_id TEXT, item_id TEXT,
			borrow_date INTEGER, due_date INTEGER, return_date INTEGER,
			is_returned INTEGER DEFAULT 0, status TEXT,
			fine_amount INTEGER DEFAULT 0, fine_paid INTEGER DEFAULT 0,
			created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY, full_name TEXT, class_name TEXT, nisn TEXT, nis TEXT,
			status TEXT, is_active INTEGER
		);
		CREATE TABLE users (
			id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT
		);
		INSERT INTO library_catalog (id, title, author, created_at, updated_at)
			VALUES ('cat-1', 'Buku Uji', 'Penulis', 1, 1);
		INSERT INTO library_members (id, max_borrow_limit, is_active, created_at, updated_at)
			VALUES ('m-1', 1000, 1, 1, 1);
	`); err != nil {
		t.Fatalf("create schema: %v", err)
	}

	// Satu aset per pinjaman agar join-nya valid.
	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	for i := 0; i < count; i++ {
		assetID := fmt.Sprintf("asset-%d", i)
		if _, err := tx.Exec(
			"INSERT INTO library_assets (id, catalog_id, status, created_at, updated_at) VALUES (?, 'cat-1', 'AVAILABLE', 1, 1)",
			assetID); err != nil {
			t.Fatalf("insert asset: %v", err)
		}
		// due_date di masa lalu = terlambat; is_returned = 0 = belum kembali.
		if _, err := tx.Exec(`
			INSERT INTO library_loans (id, member_id, item_id, borrow_date, due_date, is_returned, created_at, updated_at)
			VALUES (?, 'm-1', ?, 1700000000000, 1700000000000, 0, 1, 1)
		`, fmt.Sprintf("loan-%d", i), assetID); err != nil {
			t.Fatalf("insert loan: %v", err)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
	return db
}

// TestGetOverdueReport_MelampauiBatasHalaman memastikan laporan keterlambatan
// mengambil SELURUH data, bukan berhenti di 100 baris.
//
// Dulu GetOverdueReport memanggil GetLoans("overdue", 1, 1000), tetapi
// GetLoans memotong perPage ke 100 — jadi laporan maksimal 100 baris, dan
// ringkasan di UI menulis angka itu seolah lengkap.
func TestGetOverdueReport_MelampauiBatasHalaman(t *testing.T) {
	const want = 150
	db := setupOverdueTestDB(t, want)
	defer db.Close()
	repo := NewLibraryRepository(db)

	res, err := repo.GetOverdueReport()
	if err != nil {
		t.Fatalf("GetOverdueReport: %v", err)
	}
	if res == nil {
		t.Fatal("hasil nil")
	}
	if len(res.Items) != want {
		t.Errorf("baris diambil %d, diharapkan %d — data terpotong", len(res.Items), want)
	}
	if res.TotalItems != want {
		t.Errorf("totalItems %d, diharapkan %d", res.TotalItems, want)
	}
}

// TestGetOverdueReport_TidakAdaYangTerlambat memastikan keadaan kosang
// (bukan error) bila tidak ada pinjaman terlambat.
func TestGetOverdueReport_TidakAdaYangTerlambat(t *testing.T) {
	db := setupOverdueTestDB(t, 0)
	defer db.Close()
	repo := NewLibraryRepository(db)

	res, err := repo.GetOverdueReport()
	if err != nil {
		t.Fatalf("GetOverdueReport: %v", err)
	}
	if len(res.Items) != 0 {
		t.Errorf("baris %d, diharapkan 0", len(res.Items))
	}
	if res.TotalItems != 0 {
		t.Errorf("totalItems %d, diharapkan 0", res.TotalItems)
	}
}
