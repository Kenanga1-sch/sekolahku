package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"

	"cloudstorage/internal/config"
	"cloudstorage/internal/repository"
	"cloudstorage/internal/service"
)

func newTestHandler(t *testing.T) *fiber.App {
	t.Helper()
	tmpFile, err := os.CreateTemp("", "handler_test_*.db")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	t.Cleanup(func() { os.Remove(tmpPath) })

	db := repository.InitDB(tmpPath)
	repo := repository.NewRepository(db)
	svc := service.NewService(repo, &config.Config{})
	h := NewHandler(svc)

	app := fiber.New()
	app.Post("/folders", h.CreateFolder)
	app.Get("/files/:id", h.GetFile)
	app.Delete("/files/:id", h.DeleteFile)
	app.Post("/files/:id/share", h.CreateShareLink)
	app.Delete("/files/:id/share", h.RevokeShare)
	return app
}

func doJSON(app *fiber.App, method, path, body string) *http.Response {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := app.Test(req, 15000)
	if err != nil {
		panic(err)
	}
	return resp
}

func TestCreateFolderValidation(t *testing.T) {
	app := newTestHandler(t)
	resp := doJSON(app, "POST", "/folders", `{"name":""}`)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty name, got %d", resp.StatusCode)
	}
}

func TestCreateFolderAndGet(t *testing.T) {
	app := newTestHandler(t)
	resp := doJSON(app, "POST", "/folders", `{"name":"Dokumen"}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 creating folder, got %d", resp.StatusCode)
	}
	var f struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&f); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if f.ID == "" {
		t.Fatal("expected non-empty id")
	}

	resp = doJSON(app, "GET", "/files/"+f.ID, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 getting file, got %d", resp.StatusCode)
	}
}

func TestGetFileNotFound(t *testing.T) {
	app := newTestHandler(t)
	resp := doJSON(app, "GET", "/files/nonexistent", "")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestDeleteFileNotFound(t *testing.T) {
	app := newTestHandler(t)
	resp := doJSON(app, "DELETE", "/files/nonexistent", "")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestCreateShareLinkNotFound(t *testing.T) {
	app := newTestHandler(t)
	resp := doJSON(app, "POST", "/files/nonexistent/share", "")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestRevokeShareNotFound(t *testing.T) {
	app := newTestHandler(t)
	resp := doJSON(app, "DELETE", "/files/nonexistent/share", "")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}
