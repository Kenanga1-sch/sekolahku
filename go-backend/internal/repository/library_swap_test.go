package repository

import (
	"database/sql"
	"testing"
)

// setupSwapTestDB membuat DB in-memory dengan FK enforcement aktif untuk
// menguji SwapQR (sebelumnya gagal dengan FOREIGN KEY constraint).
func setupSwapTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file:swap?mode=memory&cache=shared")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	if _, err := db.Exec(`
		PRAGMA foreign_keys = ON;
		CREATE TABLE library_qr_codes (
			code TEXT PRIMARY KEY, batch_id TEXT, created_at INTEGER
		);
		CREATE TABLE library_catalog (
			id TEXT PRIMARY KEY, title TEXT, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE library_assets (
			id TEXT PRIMARY KEY,
			catalog_id TEXT,
			status TEXT DEFAULT 'AVAILABLE',
			created_at INTEGER, updated_at INTEGER,
			FOREIGN KEY (catalog_id) REFERENCES library_catalog(id)
		);
		CREATE TABLE library_loans (
			id TEXT PRIMARY KEY,
			member_id TEXT,
			item_id TEXT,
			is_returned INTEGER DEFAULT 0,
			created_at INTEGER,
			FOREIGN KEY (item_id) REFERENCES library_assets(id)
		);

		INSERT INTO library_catalog (id, title, created_at, updated_at)
			VALUES ('cat-1', 'Buku Tes', 1710000000000, 1710000000000);
		INSERT INTO library_assets (id, catalog_id, status, created_at, updated_at)
			VALUES ('BK-OLD', 'cat-1', 'BORROWED', 1710000000000, 1710000000000);
		INSERT INTO library_loans (id, member_id, item_id, is_returned, created_at)
			VALUES ('loan-1', 'lib-1', 'BK-OLD', 0, 1710000000000);
		INSERT INTO library_qr_codes (code, created_at) VALUES ('BK-OLD', 1710000000000);
	`); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return db
}

// TestSwapQRWithLoans memastikan QR aset yang pernah dipinjam bisa diganti
// tanpa FK violation, dan referensi peminjaman ikut berpindah.
func TestSwapQRWithLoans(t *testing.T) {
	db := setupSwapTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.SwapQR("BK-OLD", "BK-NEW"); err != nil {
		t.Fatalf("SwapQR returned error: %v", err)
	}

	var newAssetExists int
	if err := db.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = 'BK-NEW'").Scan(&newAssetExists); err != nil {
		t.Fatalf("query new asset: %v", err)
	}
	if newAssetExists == 0 {
		t.Fatalf("expected new asset BK-NEW to exist")
	}

	var oldAssetExists int
	_ = db.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = 'BK-OLD'").Scan(&oldAssetExists)
	if oldAssetExists > 0 {
		t.Fatalf("expected old asset BK-OLD to be gone")
	}

	var loanItem string
	if err := db.QueryRow("SELECT item_id FROM library_loans WHERE id = 'loan-1'").Scan(&loanItem); err != nil {
		t.Fatalf("query loan: %v", err)
	}
	if loanItem != "BK-NEW" {
		t.Fatalf("expected loan item_id moved to BK-NEW, got %s", loanItem)
	}

	// QR baru harus ter-reserve, QR lama dilepas.
	var newCodeReserved, oldCodeReserved int
	db.QueryRow("SELECT COUNT(*) FROM library_qr_codes WHERE code = 'BK-NEW'").Scan(&newCodeReserved)
	db.QueryRow("SELECT COUNT(*) FROM library_qr_codes WHERE code = 'BK-OLD'").Scan(&oldCodeReserved)
	if newCodeReserved == 0 {
		t.Fatalf("expected new QR code BK-NEW to be reserved")
	}
	if oldCodeReserved > 0 {
		t.Fatalf("expected old QR code BK-OLD to be released")
	}
}

// TestSwapQRRejectsDuplicate memastikan QR baru yang sudah dipakai aset lain
// ditolak.
func TestSwapQRRejectsDuplicate(t *testing.T) {
	db := setupSwapTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	// Tambah aset lain dengan kode tujuan.
	if _, err := db.Exec("INSERT INTO library_assets (id, catalog_id, status, created_at, updated_at) VALUES ('BK-EXIST', 'cat-1', 'AVAILABLE', 1710000000000, 1710000000000)"); err != nil {
		t.Fatalf("insert asset: %v", err)
	}

	err := repo.SwapQR("BK-OLD", "BK-EXIST")
	if err == nil {
		t.Fatalf("expected error swapping to existing QR code")
	}
}

// TestDeleteBookWithActiveLoanRejected memastikan aset yang sedang dipinjam
// tidak bisa dihapus.
func TestDeleteBookWithActiveLoanRejected(t *testing.T) {
	db := setupSwapTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	err := repo.DeleteBook("BK-OLD")
	if err == nil {
		t.Fatalf("expected error deleting borrowed book")
	}
	if err != ErrBookStillBorrowed {
		t.Fatalf("expected ErrBookStillBorrowed, got %v", err)
	}
}
