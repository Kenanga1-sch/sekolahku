package repository

import (
	"database/sql"
	"sync"
	"testing"
	_ "modernc.org/sqlite"

	"github.com/sekolahku/go-backend/internal/models"
)

func setupLibraryLoanTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1) // :memory: modernc sqlite: koneksi baru = DB baru
	_, err = db.Exec(`
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
		INSERT INTO library_catalog (id, title, author, created_at, updated_at) VALUES ('cat-1', 'Buku Uji', 'Penulis', 1, 1);
		INSERT INTO library_assets (id, catalog_id, status, created_at, updated_at) VALUES ('asset-1', 'cat-1', 'AVAILABLE', 1, 1);
		INSERT INTO library_members (id, max_borrow_limit, is_active, created_at, updated_at) VALUES ('m-1', 5, 1, 1, 1);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

// Satu buku, banyak peminjam bersamaan: hanya boleh ada 1 loan aktif.
func TestBorrowItemConcurrentSingleAsset(t *testing.T) {
	db := setupLibraryLoanTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	const n = 10
	var wg sync.WaitGroup
	results := make(chan error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := repo.BorrowItem("m-1", "asset-1", 7)
			results <- err
		}()
	}
	wg.Wait()
	close(results)

	success := 0
	for err := range results {
		if err == nil {
			success++
		}
	}
	if success != 1 {
		t.Fatalf("expected exactly 1 successful borrow, got %d", success)
	}

	var activeLoans int
	if err := db.QueryRow("SELECT COUNT(*) FROM library_loans WHERE is_returned = 0").Scan(&activeLoans); err != nil {
		t.Fatalf("count loans: %v", err)
	}
	if activeLoans != 1 {
		t.Fatalf("expected 1 active loan in db, got %d", activeLoans)
	}

	var status string
	if err := db.QueryRow("SELECT status FROM library_assets WHERE id = 'asset-1'").Scan(&status); err != nil {
		t.Fatalf("get asset: %v", err)
	}
	if status != "BORROWED" {
		t.Fatalf("expected BORROWED, got %s", status)
	}
}

// Buku yang sudah BORROWED harus ditolak.
func TestBorrowItemAlreadyBorrowed(t *testing.T) {
	db := setupLibraryLoanTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if _, err := repo.BorrowItem("m-1", "asset-1", 7); err != nil {
		t.Fatalf("first borrow should succeed: %v", err)
	}
	_, err := repo.BorrowItem("m-1", "asset-1", 7)
	if err == nil {
		t.Fatal("second borrow should fail")
	}
}

// CreateBook: gagal di tengah (copies dengan ID duplikat) tidak boleh meninggalkan catalog yatim.
func TestCreateBookAtomicRollback(t *testing.T) {
	db := setupLibraryLoanTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	// Copies=1 menghasilkan assetID = id (tanpa suffix) — sukses.
	// Lalu buat lagi dengan copies=2 dari request yang sama judulnya tidak masalah (catalog berbeda),
	// tapi paksa gagal: catalog insert kedua dengan isbn UNIQUE tidak ada,
	// jadi simulasikan via copies=1 lalu hapus tabel assets untuk memaksa error loop.
	if _, err := db.Exec("DROP TABLE library_assets"); err != nil {
		t.Fatalf("drop assets: %v", err)
	}
	err := repo.CreateBook(models.CreateBookRequest{ISBN: "isbn-x", Title: "Judul", Author: "Penulis", Copies: 1})
	if err == nil {
		t.Fatal("expected error when assets table missing")
	}
	var cnt int
	_ = db.QueryRow("SELECT COUNT(*) FROM library_catalog WHERE isbn = 'isbn-x'").Scan(&cnt)
	if cnt != 0 {
		t.Fatalf("catalog leaked after failed create: %d rows", cnt)
	}
}
