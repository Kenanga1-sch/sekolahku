package handlers

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupAnnouncementHandlerTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT
		);
		CREATE TABLE announcements (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			slug TEXT UNIQUE NOT NULL,
			content TEXT,
			excerpt TEXT,
			category TEXT,
			thumbnail TEXT,
			is_published INTEGER,
			is_featured INTEGER,
			published_at INTEGER,
			author_id TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		INSERT INTO announcements (
			id, title, slug, content, excerpt, category, thumbnail,
			is_published, is_featured, published_at, created_at, updated_at
		) VALUES (
			'ann-1', 'Judul Lama', 'judul-lama', 'Konten lama', 'Ringkasan lama',
			'pengumuman', '/uploads/announcements/lama.jpg', 0, 0, 0, 1710000000000, 1710000000000
		);
	`)
	if err != nil {
		t.Fatalf("failed to create announcement schema: %v", err)
	}

	return db
}

func TestAnnouncementUpdateMergesPartialPayload(t *testing.T) {
	db := setupAnnouncementHandlerTestDB(t)
	defer db.Close()

	handler := NewAnnouncementHandler(repository.NewAnnouncementRepository(db))
	e := echo.New()
	req := httptest.NewRequest(http.MethodPatch, "/api/announcements/ann-1", strings.NewReader(`{"is_published":true}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	ctx.SetParamNames("id")
	ctx.SetParamValues("ann-1")

	if err := handler.UpdateAnnouncement(ctx); err != nil {
		t.Fatalf("UpdateAnnouncement returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", rec.Code, rec.Body.String())
	}

	updated, err := repository.NewAnnouncementRepository(db).GetAnnouncementBySlug("ann-1")
	if err != nil {
		t.Fatalf("GetAnnouncementBySlug returned error: %v", err)
	}
	if updated == nil {
		t.Fatal("expected announcement to exist")
	}
	if updated.Title != "Judul Lama" || updated.Content == nil || *updated.Content != "Konten lama" {
		t.Fatalf("partial update should preserve existing content, got %#v", updated)
	}
	if !updated.IsPublished || updated.PublishedAt == nil {
		t.Fatalf("partial update should publish announcement, got %#v", updated)
	}
}
