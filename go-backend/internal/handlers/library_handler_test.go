package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupLibraryHandlerTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE library_catalog (
			id TEXT PRIMARY KEY,
			isbn TEXT,
			title TEXT,
			author TEXT,
			publisher TEXT,
			year TEXT,
			category TEXT,
			description TEXT,
			cover TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE library_assets (
			id TEXT PRIMARY KEY,
			catalog_id TEXT,
			code TEXT,
			status TEXT DEFAULT 'AVAILABLE',
			location TEXT,
			condition TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		INSERT INTO library_catalog (id, isbn, title, author, publisher, category, created_at, updated_at)
		VALUES
			('cat-1', '978-001', 'Buku Satu', 'Penulis A', 'Publisher X', 'fiksi', 1710000000000, 1710000000000),
			('cat-2', '978-002', 'Buku Dua', 'Penulis B', 'Publisher Y', 'non-fiksi', 1710000001000, 1710000001000),
			('cat-3', '978-003', 'Buku Tiga', 'Penulis C', 'Publisher Z', 'fiksi', 1710000002000, 1710000002000);
		INSERT INTO library_assets (id, catalog_id, code, status, created_at, updated_at)
		VALUES
			('asset-1', 'cat-1', 'BK-001', 'AVAILABLE', 1710000000000, 1710000000000),
			('asset-2', 'cat-2', 'BK-002', 'AVAILABLE', 1710000001000, 1710000001000),
			('asset-3', 'cat-3', 'BK-003', 'BORROWED', 1710000002000, 1710000002000);
	`)
	if err != nil {
		t.Fatalf("failed to create library schema: %v", err)
	}
	return db
}

func TestLibraryGetBooksPagination(t *testing.T) {
	db := setupLibraryHandlerTestDB(t)
	defer db.Close()

	handler := NewLibraryHandler(repository.NewLibraryRepository(db))
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/api/library/books?page=1&perPage=2", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.GetBooks(ctx); err != nil {
		t.Fatalf("GetBooks returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	totalItems, ok := resp["totalItems"].(float64)
	if !ok || totalItems != 3 {
		t.Errorf("expected totalItems=3, got %v (type %T)", resp["totalItems"], resp["totalItems"])
	}
	page, ok := resp["page"].(float64)
	if !ok || page != 1 {
		t.Errorf("expected page=1, got %v", resp["page"])
	}
	items, ok := resp["items"].([]interface{})
	if !ok {
		t.Errorf("expected items to be array, got %T", resp["items"])
	} else if len(items) != 2 {
		t.Errorf("expected 2 items on page 1, got %d", len(items))
	}
}

func TestLibraryGetBooksFilterByStatus(t *testing.T) {
	db := setupLibraryHandlerTestDB(t)
	defer db.Close()

	handler := NewLibraryHandler(repository.NewLibraryRepository(db))
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/api/library/books?status=borrowed", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.GetBooks(ctx); err != nil {
		t.Fatalf("GetBooks returned error: %v", err)
	}

	var resp2 map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp2); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	totalItems, ok := resp2["totalItems"].(float64)
	if !ok || totalItems != 1 {
		t.Errorf("expected totalItems=1 for borrowed books, got totalItems=%v (type %T)", resp2["totalItems"], resp2["totalItems"])
	}
}
