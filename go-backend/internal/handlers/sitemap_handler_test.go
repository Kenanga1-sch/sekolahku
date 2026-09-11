package handlers

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

// modelsCreateAnnouncementRequest helper untuk membuat permintaan berita.
func modelsCreateAnnouncementRequest(title, slug string, published bool) models.CreateAnnouncementRequest {
	return models.CreateAnnouncementRequest{
		Title:       title,
		Slug:        slug,
		Content:     strPtrForSitemap("<p>isi</p>"),
		IsPublished: published,
	}
}

// strPtrForSitemap menghindari bentrok dengan helper strPtr di test file lain.
func strPtrForSitemap(s string) *string { return &s }

// setupSitemapTestDB membuat DB in-memory dengan tabel announcements.
func setupSitemapTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`
		CREATE TABLE announcements (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			content TEXT,
			excerpt TEXT,
			category TEXT,
			thumbnail TEXT,
			is_published INTEGER DEFAULT 0,
			is_featured INTEGER DEFAULT 0,
			published_at INTEGER,
			author_id TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
	`); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

// TestSitemapNewsHandlerWithoutPublicURL memastikan handler tidak crash bila
// PUBLIC_BASE_URL tidak diset (mis. di lingkungan dev) — harus tetap menghasilkan
// sitemap valid kosong, bukan 500.
func TestSitemapNewsHandlerWithoutPublicURL(t *testing.T) {
	h := NewSitemapHandler(repository.NewAnnouncementRepository(setupSitemapTestDB(t)))
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/sitemap-news.xml", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.News(ctx); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "<urlset") {
		t.Errorf("root urlset hilang: %s", body)
	}
}

// TestSitemapNewsHandlerServesPublishedOnly memastikan hanya berita
// terpublikasi yang masuk sitemap.
func TestSitemapNewsHandlerServesPublishedOnly(t *testing.T) {
	t.Setenv("PUBLIC_BASE_URL", "https://sdn1kenanga.sch.id")

	db := setupSitemapTestDB(t)
	repo := repository.NewAnnouncementRepository(db)

	// Satu terpublikasi, satu draft.
	if _, err := repo.CreateAnnouncement(modelsCreateAnnouncementRequest("Publik", "publik-slug", true)); err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := repo.CreateAnnouncement(modelsCreateAnnouncementRequest("Draft", "draft-slug", false)); err != nil {
		t.Fatalf("create: %v", err)
	}

	h := NewSitemapHandler(repo)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/sitemap-news.xml", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.News(ctx); err != nil {
		t.Fatalf("handler error: %v", err)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "publik-slug") {
		t.Errorf("berita terpublikasi harus ada di sitemap:\n%s", body)
	}
	if strings.Contains(body, "draft-slug") {
		t.Errorf("draft tidak boleh ada di sitemap:\n%s", body)
	}
	if !strings.Contains(body, "https://sdn1kenanga.sch.id/berita/detail?slug=publik-slug") {
		t.Errorf("URL harus absolut ke /berita/detail:\n%s", body)
	}
}
