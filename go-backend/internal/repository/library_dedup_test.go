package repository

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/sekolahku/go-backend/internal/models"
)

func setupDedupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE library_catalog (
			id TEXT PRIMARY KEY, isbn TEXT, title TEXT, author TEXT, publisher TEXT,
			year INTEGER, category TEXT, description TEXT, cover TEXT, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE library_assets (
			id TEXT PRIMARY KEY, catalog_id TEXT, status TEXT DEFAULT 'AVAILABLE',
			location TEXT, condition TEXT, created_at INTEGER, updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

func catalogOf(t *testing.T, repo *LibraryRepository, assetID string) string {
	t.Helper()
	var cid string
	if err := repo.DB.QueryRow("SELECT catalog_id FROM library_assets WHERE id = ?", assetID).Scan(&cid); err != nil {
		t.Fatalf("catalogOf: %v", err)
	}
	return cid
}

func countCatalogs(t *testing.T, repo *LibraryRepository) int {
	t.Helper()
	var n int
	if err := repo.DB.QueryRow("SELECT COUNT(*) FROM library_catalog").Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

// ISBN sama + judul sama → 1 katalog (eksemplar ke-N).
func TestBindSameISBNSameTitleReuses(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	in := models.CatalogInput{ISBN: "9781234567890", Title: "Matematika Kelas 1", Author: "A"}
	if err := repo.BindAsset("QR-1", "RAK-500", in); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-500", in); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	if n := countCatalogs(t, repo); n != 1 {
		t.Fatalf("harus 1 katalog, got %d", n)
	}
	if catalogOf(t, repo, "QR-1") != catalogOf(t, repo, "QR-2") {
		t.Fatalf("eksemplar harus se-katalog")
	}
}

// ISBN sama + judul BEDA → 2 katalog (inti perbaikan: buku kedua tidak nyangkut).
func TestBindSameISBNDifferentTitleSplits(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{ISBN: "9781234567890", Title: "Matematika Kelas 1", Author: "A"}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-800", models.CatalogInput{ISBN: "9781234567890", Title: "Cerita Rakyat Nusantara", Author: "B"}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	if n := countCatalogs(t, repo); n != 2 {
		t.Fatalf("harus 2 katalog, got %d", n)
	}
	if catalogOf(t, repo, "QR-1") == catalogOf(t, repo, "QR-2") {
		t.Fatalf("judul beda harus beda katalog")
	}
	var title string
	if err := repo.DB.QueryRow("SELECT title FROM library_catalog WHERE id = ?", catalogOf(t, repo, "QR-1")).Scan(&title); err != nil {
		t.Fatalf("read: %v", err)
	}
	if title != "Matematika Kelas 1" {
		t.Fatalf("judul katalog pertama tertimpa: %q", title)
	}
}

// Varian penulisan judul (kapital/tanda baca) → tetap 1 katalog.
func TestBindTitleNormalization(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{ISBN: "9781234567890", Title: "Matematika Kelas 1"}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-500", models.CatalogInput{ISBN: "9781234567890", Title: "MATEMATIKA Kelas 1!"}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	if n := countCatalogs(t, repo); n != 1 {
		t.Fatalf("varian penulisan harus 1 katalog, got %d", n)
	}
}

// LookupISBN multi-hit → Candidates terisi semua katalog.
func TestLookupISBNMultiHit(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{ISBN: "9781234567890", Title: "Matematika Kelas 1", Author: "A"}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-800", models.CatalogInput{ISBN: "9781234567890", Title: "Cerita Rakyat", Author: "B"}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	res, err := repo.LookupISBN("9781234567890")
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if !res.LocalFound {
		t.Fatalf("harus localFound")
	}
	if len(res.Candidates) != 2 {
		t.Fatalf("harus 2 kandidat, got %d", len(res.Candidates))
	}
}

// UpdateBook copy-on-write: katalog dipakai 2 aset + judul diubah → aset
// pindah ke katalog baru, katalog lama utuh.
func TestUpdateBookCopyOnWrite(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	in := models.CatalogInput{ISBN: "9781234567890", Title: "Matematika Kelas 1", Author: "A"}
	if err := repo.BindAsset("QR-1", "RAK-500", in); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-500", in); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	oldCatalog := catalogOf(t, repo, "QR-1")

	author := "A"
	if err := repo.UpdateBook("QR-2", models.UpdateBookRequest{
		ISBN: "9781234567890", Title: "Matematika Kelas 1 (Revisi)", Author: &author, Location: "RAK-500",
	}); err != nil {
		t.Fatalf("update: %v", err)
	}
	if got := catalogOf(t, repo, "QR-2"); got == oldCatalog {
		t.Fatalf("aset harus pindah katalog baru")
	}
	if got := catalogOf(t, repo, "QR-1"); got != oldCatalog {
		t.Fatalf("aset lain harus tetap di katalog lama")
	}
	var title string
	if err := repo.DB.QueryRow("SELECT title FROM library_catalog WHERE id = ?", oldCatalog).Scan(&title); err != nil {
		t.Fatalf("read: %v", err)
	}
	if title != "Matematika Kelas 1" {
		t.Fatalf("katalog lama tertimpa: %q", title)
	}
}

// UpdateBook katalog tunggal → update langsung (tanpa split).
func TestUpdateBookSingleCatalog(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{ISBN: "111", Title: "Judul Lama", Author: "A"}); err != nil {
		t.Fatalf("bind: %v", err)
	}
	oldCatalog := catalogOf(t, repo, "QR-1")

	author := "A"
	if err := repo.UpdateBook("QR-1", models.UpdateBookRequest{
		ISBN: "111", Title: "Judul Baru", Author: &author, Location: "RAK-600",
	}); err != nil {
		t.Fatalf("update: %v", err)
	}
	if got := catalogOf(t, repo, "QR-1"); got != oldCatalog {
		t.Fatalf("katalog tunggal tidak boleh split")
	}
	var title, loc string
	if err := repo.DB.QueryRow("SELECT title FROM library_catalog WHERE id = ?", oldCatalog).Scan(&title); err != nil {
		t.Fatalf("read: %v", err)
	}
	if title != "Judul Baru" {
		t.Fatalf("judul harus terupdate: %q", title)
	}
	if err := repo.DB.QueryRow("SELECT location FROM library_assets WHERE id = 'QR-1'").Scan(&loc); err != nil {
		t.Fatalf("read loc: %v", err)
	}
	if loc != "RAK-600" {
		t.Fatalf("lokasi harus terupdate: %q", loc)
	}
}
