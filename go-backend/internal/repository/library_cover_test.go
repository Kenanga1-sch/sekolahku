package repository

import (
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
)

func coverOf(t *testing.T, repo *LibraryRepository, catalogID string) string {
	t.Helper()
	var cover string
	if err := repo.DB.QueryRow("SELECT COALESCE(cover,'') FROM library_catalog WHERE id = ?", catalogID).Scan(&cover); err != nil {
		t.Fatalf("coverOf: %v", err)
	}
	return cover
}

const (
	coverISBN   = "9786028134255"
	coverFirst  = "/uploads/library/covers/9786028134255-1-a.webp"
	coverSecond = "/uploads/library/covers/9786028134255-2-b.webp"
)

// 1 ISBN dipakai 2 judul: judul BARU tidak boleh mewarisi sampul judul
// pertama. Inilah bug yang membuat judul baru memakai sampul judul pertama.
func TestBindNewTitleDoesNotInheritOtherCover(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Pertama", Cover: coverFirst, CoverOverwrite: true,
	}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	first := catalogOf(t, repo, "QR-1")

	// Judul kedua dibuat tanpa mengunggah sampul: sampul judul pertama tidak
	// boleh ikut tersalin.
	if err := repo.BindAsset("QR-2", "RAK-800", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Kedua", Cover: coverFirst,
	}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	second := catalogOf(t, repo, "QR-2")
	if second == first {
		t.Fatalf("judul berbeda harus membuat katalog baru")
	}
	if got := coverOf(t, repo, second); got != "" {
		t.Fatalf("judul baru tidak boleh mewarisi sampul judul lain, got %q", got)
	}
	if got := coverOf(t, repo, first); got != coverFirst {
		t.Fatalf("sampul judul pertama harus tetap utuh, got %q", got)
	}
}

// Judul baru dengan sampul hasil unggahan sendiri -> sampul itu dipakai.
func TestBindNewTitleWithOwnCover(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Pertama", Cover: coverFirst, CoverOverwrite: true,
	}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-800", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Kedua", Cover: coverSecond, CoverOverwrite: true,
	}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	first := catalogOf(t, repo, "QR-1")
	second := catalogOf(t, repo, "QR-2")
	if got := coverOf(t, repo, first); got != coverFirst {
		t.Fatalf("sampul judul pertama berubah: %q", got)
	}
	if got := coverOf(t, repo, second); got != coverSecond {
		t.Fatalf("sampul judul kedua harus %q, got %q", coverSecond, got)
	}
}

// Katalog yang sudah punya sampul + unggahan baru (flag overwrite) ->
// sampul lama ditimpa.
func TestBindExistingCatalogOverwritesCover(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Pertama", Cover: coverFirst, CoverOverwrite: true,
	}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	first := catalogOf(t, repo, "QR-1")

	if err := repo.BindAsset("QR-2", "RAK-500", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Pertama", CatalogID: first, Cover: coverSecond, CoverOverwrite: true,
	}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	if got := coverOf(t, repo, first); got != coverSecond {
		t.Fatalf("sampul katalog harus tertimpa, got %q", got)
	}
	if n := countCatalogs(t, repo); n != 1 {
		t.Fatalf("tidak boleh ada katalog baru, got %d", n)
	}
}

// Tanpa flag overwrite, sampul katalog yang sudah ada tidak boleh ditimpa.
func TestBindExistingCatalogKeepsCover(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Pertama", Cover: coverFirst, CoverOverwrite: true,
	}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	first := catalogOf(t, repo, "QR-1")

	if err := repo.BindAsset("QR-2", "RAK-500", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Pertama", CatalogID: first, Cover: coverSecond,
	}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	if got := coverOf(t, repo, first); got != coverFirst {
		t.Fatalf("sampul lama tidak boleh ditimpa tanpa flag overwrite, got %q", got)
	}
}

// Katalog tanpa sampul + sampul baru (tanpa overwrite) -> boleh diisi karena
// katalog itu belum punya sampul sendiri.
func TestBindExistingCatalogFillsEmptyCover(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Pertama",
	}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	first := catalogOf(t, repo, "QR-1")
	if got := coverOf(t, repo, first); got != "" {
		t.Fatalf("katalog baru seharusnya tanpa sampul, got %q", got)
	}

	if err := repo.BindAsset("QR-2", "RAK-500", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Pertama", CatalogID: first, Cover: coverFirst,
	}); err != nil {
		t.Fatalf("bind2: %v", err)
	}
	if got := coverOf(t, repo, first); got != coverFirst {
		t.Fatalf("katalog kosong harus diisi sampul, got %q", got)
	}
}

// Kandidat ISBN membawa sampul milik masing-masing katalog, supaya picker
// di frontend bisa menampilkan sampul yang benar (tidak tertukar).
func TestLookupISBCandidatesCarryOwnCover(t *testing.T) {
	db := setupDedupTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	if err := repo.BindAsset("QR-1", "RAK-500", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Pertama", Cover: coverFirst, CoverOverwrite: true,
	}); err != nil {
		t.Fatalf("bind1: %v", err)
	}
	if err := repo.BindAsset("QR-2", "RAK-800", models.CatalogInput{
		ISBN: coverISBN, Title: "Judul Kedua", Cover: coverSecond, CoverOverwrite: true,
	}); err != nil {
		t.Fatalf("bind2: %v", err)
	}

	res, err := repo.LookupISBN(coverISBN)
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if len(res.Candidates) != 2 {
		t.Fatalf("harus 2 kandidat, got %d", len(res.Candidates))
	}
	byTitle := map[string]string{}
	for _, c := range res.Candidates {
		byTitle[c.Title] = c.Cover
	}
	if byTitle["Judul Pertama"] != coverFirst {
		t.Fatalf("sampul kandidat judul pertama salah: %q", byTitle["Judul Pertama"])
	}
	if byTitle["Judul Kedua"] != coverSecond {
		t.Fatalf("sampul kandidat judul kedua salah: %q", byTitle["Judul Kedua"])
	}
}

