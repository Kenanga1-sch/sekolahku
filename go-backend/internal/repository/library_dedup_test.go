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

// Judul input tidak pernah ditimpa katalog lain: ISBN sama, judul beda →
// katalog baru dengan judul yang diinput user.
func TestBindSameISBNNewTitleKeepsInputTitle(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{ISBN: "9781234567890", Title: "Matematika Kelas 1"}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-800", models.CatalogInput{ISBN: "9781234567890", Title: "Cerita Rakyat"}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	if n := countCatalogs(t, repo); n != 2 {
		t.Fatalf("harus 2 katalog, got %d", n)
	}
	var title string
	if err := repo.DB.QueryRow("SELECT title FROM library_catalog WHERE id = ?", catalogOf(t, repo, "QR-2")).Scan(&title); err != nil {
		t.Fatalf("scan: %v", err)
	}
	if title != "Cerita Rakyat" {
		t.Fatalf("judul katalog kedua harus 'Cerita Rakyat', got %q", title)
	}
}

// Pilihan katalog eksplisit: eksemplar masuk ke katalog yang dipilih, meski
// judul input berbeda, dan judul katalog tidak berubah.
func TestBindExplicitCatalogChoice(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{ISBN: "9781234567890", Title: "Matematika Kelas 1"}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-800", models.CatalogInput{ISBN: "9781234567890", Title: "Cerita Rakyat"}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	first := catalogOf(t, repo, "QR-1")
	if err := repo.BindAsset("QR-3", "RAK-500", models.CatalogInput{ISBN: "9781234567890", Title: "Matematika Kelas 1", CatalogID: first}); err != nil {
		t.Fatalf("bind3: %v", err)
	}
	if got := catalogOf(t, repo, "QR-3"); got != first {
		t.Fatalf("eksemplar harus masuk katalog pilihan %s, got %s", first, got)
	}
	if n := countCatalogs(t, repo); n != 2 {
		t.Fatalf("tidak boleh ada katalog baru, got %d", n)
	}
}

// Lookup ISBN lokal: kandidat dikembalikan dan tidak memanggil API luar.
func TestLookupISBNLocalOnlyNotFound(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if _, err := repo.LookupISBN("9780000000002"); err == nil {
		t.Fatalf("ISBN tidak ada di katalog harus mengembalikan error (not found)")
	}
}

// Buku tanpa penulis tetap bisa disimpan (hanya judul wajib).
func TestCreateBookTitleOnly(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.CreateBook(models.CreateBookRequest{Title: "Judul Saja", Copies: 1, Location: "RAK-500"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	if n := countCatalogs(t, repo); n != 1 {
		t.Fatalf("harus 1 katalog, got %d", n)
	}
}

// Cari Judul hanya membaca katalog lokal — hasil lokal harus muncul dengan
// LocalFound=true dan TotalExemplars yang benar, tanpa menyentuh API luar.
func TestSearchBooksByTitleLocalOnly(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{ISBN: "9781234567890", Title: "Laskar Pelangi", Author: "Andrea Hirata"}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-500", models.CatalogInput{ISBN: "9781234567890", Title: "Laskar Pelangi", Author: "Andrea Hirata"}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	if err := repo.BindAsset("QR-3", "RAK-800", models.CatalogInput{ISBN: "9780000000002", Title: "Bumi Manusia", Author: "Pramoedya"}); err != nil {
		t.Fatalf("bind3: %v", err)
	}

	res, err := repo.SearchBooksByTitle("Laskar", 1, 10)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if res.TotalItems != 1 {
		t.Fatalf("harus 1 hasil lokal, got %d", res.TotalItems)
	}
	if len(res.Results) != 1 {
		t.Fatalf("harus 1 result, got %d", len(res.Results))
	}
	got := res.Results[0]
	if !got.LocalFound {
		t.Fatalf("hasil harus LocalFound=true")
	}
	if got.Title != "Laskar Pelangi" {
		t.Fatalf("judul salah: %q", got.Title)
	}
	if got.TotalExemplars != 2 {
		t.Fatalf("eksemplar harus 2, got %d", got.TotalExemplars)
	}
	if got.ID == "" {
		t.Fatalf("ID katalog harus terisi agar eksemplar bisa masuk katalog yang sama")
	}
}

// Cari Judul dengan kata kunci penulis juga menemukan katalog lokal.
func TestSearchBooksByTitleByAuthor(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{ISBN: "111", Title: "Cerita Rakyat", Author: "Andrea Hirata"}); err != nil {
		t.Fatalf("bind: %v", err)
	}

	res, err := repo.SearchBooksByTitle("Andrea", 1, 10)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if res.TotalItems != 1 || len(res.Results) != 1 {
		t.Fatalf("harus 1 hasil via penulis, got total=%d len=%d", res.TotalItems, len(res.Results))
	}
}

// Cari Judul tanpa hasil → daftar kosong (bukan error), supaya UI bisa
// menawarkan "judul baru".
func TestSearchBooksByTitleEmpty(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	res, err := repo.SearchBooksByTitle("Tidak Ada Judul Ini", 1, 10)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if res.TotalItems != 0 || len(res.Results) != 0 {
		t.Fatalf("harus kosong, got total=%d len=%d", res.TotalItems, len(res.Results))
	}
	if res.HasMore {
		t.Fatalf("HasMore harus false saat kosong")
	}
}
