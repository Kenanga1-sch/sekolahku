package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupGalleryTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE gallery (
			id TEXT PRIMARY KEY,
			title TEXT,
			description TEXT,
			category TEXT,
			image_url TEXT NOT NULL,
			public_id TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("failed to create gallery schema: %v", err)
	}

	return db
}

func TestGalleryRepositoryUsesGalleryTable(t *testing.T) {
	db := setupGalleryTestDB(t)
	defer db.Close()

	repo := NewGalleryRepository(db)
	desc := "Dokumentasi kegiatan sekolah"
	id, err := repo.Create(models.GalleryItem{
		Title:       "Kegiatan Pramuka",
		Description: &desc,
		Category:    "kegiatan",
		ImageUrl:    "/uploads/gallery/pramuka.jpg",
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	items, err := repo.GetGallery("kegiatan")
	if err != nil {
		t.Fatalf("GetGallery returned error: %v", err)
	}
	if len(items) != 1 || items[0].ID != id || items[0].ImageUrl == "" {
		t.Fatalf("expected created gallery item, got %#v", items)
	}

	stats, err := repo.GetStats()
	if err != nil {
		t.Fatalf("GetStats returned error: %v", err)
	}
	if stats.Total != 1 || stats.Categories["kegiatan"] != 1 {
		t.Fatalf("unexpected stats: %#v", stats)
	}

	if err := repo.Update(id, "Upacara Bendera", "prestasi"); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	updated, err := repo.GetByID(id)
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if updated.Title != "Upacara Bendera" || updated.Category != "prestasi" {
		t.Fatalf("expected updated item, got %#v", updated)
	}

	if err := repo.Delete(id); err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
}
