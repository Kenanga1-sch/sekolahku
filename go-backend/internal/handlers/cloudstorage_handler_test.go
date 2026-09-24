package handlers

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	_ "modernc.org/sqlite"

	"github.com/sekolahku/go-backend/internal/cloudstorage"
	"github.com/sekolahku/go-backend/internal/repository"
)

// fakeTelegramHandler adalah TelegramAPI tiruan untuk pengujian handler.
type memTelegram struct {
	n     int64
	store map[string][]byte
}

func newMemTelegram() *memTelegram { return &memTelegram{store: map[string][]byte{}} }

func (m *memTelegram) SendDocument(ctx context.Context, r io.Reader, filename, chatID string) (string, int64, int64, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return "", 0, 0, err
	}
	m.n++
	id := fmt.Sprintf("f%d", m.n)
	m.store[id] = data
	return id, int64(len(data)), m.n, nil
}

func (m *memTelegram) CopyMessage(ctx context.Context, fromChatID string, messageID int64, toChatID string) (int64, error) {
	return messageID + 1000, nil
}

func (m *memTelegram) GetFilePath(ctx context.Context, fileID string) (string, error) {
	return fileID, nil
}

func (m *memTelegram) DownloadStream(ctx context.Context, filePath, rangeHeader string) (*http.Response, error) {
	data, ok := m.store[filePath]
	if !ok {
		return nil, os.ErrNotExist
	}
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(data)), ContentLength: int64(len(data)), Header: http.Header{"Content-Type": {"application/octet-stream"}}}, nil
}

func (m *memTelegram) DeleteMessage(ctx context.Context, chatID string, messageID int64) error {
	return nil
}

func setupCloudHandler(t *testing.T) (*CloudStorageHandler, *echo.Echo) {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	_, err = db.Exec(`
		CREATE TABLE cloud_files (
			id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
			parent_id TEXT, is_folder INTEGER NOT NULL DEFAULT 0, file_id TEXT,
			message_id INTEGER, mime_type TEXT, size INTEGER NOT NULL DEFAULT 0,
			encrypted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER,
			share_token TEXT, share_expires_at INTEGER,
			is_starred INTEGER NOT NULL DEFAULT 0, accessed_at INTEGER,
			sort_order INTEGER NOT NULL DEFAULT 0, share_kind TEXT
		);
		CREATE UNIQUE INDEX idx_cloud_files_unique_name
			ON cloud_files(owner_id, name, COALESCE(parent_id, '')) WHERE deleted_at IS NULL;
	`)
	if err != nil {
		t.Fatalf("schema: %v", err)
	}
	repo := repository.NewCloudStorageRepository(db)
	svc := cloudstorage.NewService(repo, newMemTelegram(), cloudstorage.Config{BotToken: "t", ChatID: "c", MaxUploadBytes: 50 << 20})
	h := &CloudStorageHandler{Svc: svc}

	e := echo.New()
	g := e.Group("/api/cloud")
	g.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("user_id", c.Request().Header.Get("X-Test-User"))
			return next(c)
		}
	})
	g.GET("/files", h.ListFiles)
	g.POST("/files", h.Upload)
	g.POST("/folders", h.CreateFolder)
	g.GET("/files/:id", h.GetFile)
	g.GET("/files/:id/download", h.Download)
	g.PUT("/files/:id", h.Rename)
	g.DELETE("/files/:id", h.Trash)
	g.GET("/trash", h.ListTrash)
	g.POST("/files/:id/share", h.CreateShare)
	g.GET("/files/:id/thumb", h.Thumbnail)
	g.POST("/files/zip", h.Zip)
	g.POST("/files/reorder", h.Reorder)
	g.POST("/files/:id/star", h.SetStar)
	g.PUT("/files/:id/content", h.UpdateContent)
	g.POST("/files/:id/rotate", h.Rotate)
	g.POST("/notes", h.CreateNote)
	g.POST("/files/move", h.Move)
	return h, e
}

func doJSON(t *testing.T, e *echo.Echo, method, path, user, body string) *httptest.ResponseRecorder {
	t.Helper()
	var rdr io.Reader
	if body != "" {
		rdr = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, rdr)
	req.Header.Set("X-Test-User", user)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestCloudHandlerCreateFolderAndRename(t *testing.T) {
	_, e := setupCloudHandler(t)

	rec := doJSON(t, e, http.MethodPost, "/api/cloud/folders", "u1", `{"name":"Dokumen"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create folder: %d %s", rec.Code, rec.Body.String())
	}
	var folder map[string]any
	json.Unmarshal(rec.Body.Bytes(), &folder)
	id, _ := folder["id"].(string)
	if id == "" {
		t.Fatal("folder id kosong")
	}

	rec = doJSON(t, e, http.MethodPut, "/api/cloud/files/"+id, "u1", `{"name":"Arsip"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("rename: %d %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "Arsip") {
		t.Fatalf("rename tidak terlihat: %s", rec.Body.String())
	}
}

func TestCloudHandlerOwnerIsolation(t *testing.T) {
	_, e := setupCloudHandler(t)
	doJSON(t, e, http.MethodPost, "/api/cloud/folders", "u1", `{"name":"Rahasia"}`)

	// user2 tidak melihat apa-apa
	rec := doJSON(t, e, http.MethodGet, "/api/cloud/files", "u2", "")
	var files []any
	json.Unmarshal(rec.Body.Bytes(), &files)
	if len(files) != 0 {
		t.Fatalf("user2 melihat %d item user1", len(files))
	}
}

func TestCloudHandlerUploadAndDownload(t *testing.T) {
	_, e := setupCloudHandler(t)

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", "laporan.pdf")
	fw.Write([]byte("isi-dokumen"))
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/cloud/files", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("X-Test-User", "u1")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload: %d %s", rec.Code, rec.Body.String())
	}
	var up map[string]any
	json.Unmarshal(rec.Body.Bytes(), &up)
	id, _ := up["id"].(string)

	// download
	rec = doJSON(t, e, http.MethodGet, "/api/cloud/files/"+id+"/download", "u1", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("download: %d", rec.Code)
	}
	if rec.Body.String() != "isi-dokumen" {
		t.Fatalf("isi download salah: %q", rec.Body.String())
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, "laporan.pdf") {
		t.Fatalf("content-disposition salah: %q", cd)
	}
}

// uploadTestFile mengunggah berkas bernama name via route upload dan
// mengembalikan id-nya.
func uploadTestFile(t *testing.T, e *echo.Echo, user, name, content string) string {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", name)
	fw.Write([]byte(content))
	mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/cloud/files", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("X-Test-User", user)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload %s: %d %s", name, rec.Code, rec.Body.String())
	}
	var up map[string]any
	json.Unmarshal(rec.Body.Bytes(), &up)
	id, _ := up["id"].(string)
	if id == "" {
		t.Fatalf("upload %s: id kosong", name)
	}
	return id
}

func TestCloudHandlerStarAndViews(t *testing.T) {
	_, e := setupCloudHandler(t)
	id := uploadTestFile(t, e, "u1", "favorit.txt", "hello")

	rec := doJSON(t, e, http.MethodPost, "/api/cloud/files/"+id+"/star", "u1", `{"starred":true}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("star: %d %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"is_starred":true`) {
		t.Fatalf("is_starred tidak true: %s", rec.Body.String())
	}

	// view=starred menampilkan berkas tadi
	rec = doJSON(t, e, http.MethodGet, "/api/cloud/files?view=starred", "u1", "")
	var files []map[string]any
	json.Unmarshal(rec.Body.Bytes(), &files)
	if len(files) != 1 {
		t.Fatalf("view starred: %d item (harap 1)", len(files))
	}

	// unstar → view kosong
	doJSON(t, e, http.MethodPost, "/api/cloud/files/"+id+"/star", "u1", `{"starred":false}`)
	rec = doJSON(t, e, http.MethodGet, "/api/cloud/files?view=starred", "u1", "")
	json.Unmarshal(rec.Body.Bytes(), &files)
	if len(files) != 0 {
		t.Fatalf("setelah unstar masih %d item", len(files))
	}
}

func TestCloudHandlerSortAndFilter(t *testing.T) {
	_, e := setupCloudHandler(t)
	uploadTestFile(t, e, "u1", "besar.bin", strings.Repeat("x", 500))
	uploadTestFile(t, e, "u1", "kecil.txt", "a")

	// sort=size → yang terbesar dulu
	rec := doJSON(t, e, http.MethodGet, "/api/cloud/files?sort=size", "u1", "")
	var files []map[string]any
	json.Unmarshal(rec.Body.Bytes(), &files)
	if len(files) != 2 {
		t.Fatalf("sort size: %d item", len(files))
	}
	if files[0]["name"] != "besar.bin" {
		t.Fatalf("urutannya salah: %v", files[0]["name"])
	}

	// filter type=doc → hanya teks (kecil.txt)
	rec = doJSON(t, e, http.MethodGet, "/api/cloud/files?type=doc", "u1", "")
	json.Unmarshal(rec.Body.Bytes(), &files)
	if len(files) != 1 || files[0]["name"] != "kecil.txt" {
		t.Fatalf("filter doc salah: %+v", files)
	}
}

func TestCloudHandlerZip(t *testing.T) {
	_, e := setupCloudHandler(t)
	fid := uploadTestFile(t, e, "u1", "satu.txt", "konten-satu")
	// folder + isi
	rec := doJSON(t, e, http.MethodPost, "/api/cloud/folders", "u1", `{"name":"Folder"}`)
	var folder map[string]any
	json.Unmarshal(rec.Body.Bytes(), &folder)
	folderID, _ := folder["id"].(string)

	body := fmt.Sprintf(`{"ids":["%s","%s"]}`, fid, folderID)
	rec = doJSON(t, e, http.MethodPost, "/api/cloud/files/zip", "u1", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("zip: %d %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/zip" {
		t.Fatalf("content-type bukan zip: %q", ct)
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, ".zip") {
		t.Fatalf("content-disposition zip salah: %q", cd)
	}
	// Verifikasi arsip benar-benar bisa dibaca dan berisi berkas kita.
	zr, err := zip.NewReader(bytes.NewReader(rec.Body.Bytes()), int64(rec.Body.Len()))
	if err != nil {
		t.Fatalf("baca zip: %v", err)
	}
	found := false
	for _, f := range zr.File {
		if f.Name == "satu.txt" {
			found = true
			rc, _ := f.Open()
			data, _ := io.ReadAll(rc)
			rc.Close()
			if string(data) != "konten-satu" {
				t.Fatalf("isi zip salah: %q", string(data))
			}
		}
	}
	if !found {
		t.Fatalf("satu.txt tidak ada di zip: %+v", zr.File)
	}
}

func TestCloudHandlerTextEditor(t *testing.T) {
	_, e := setupCloudHandler(t)
	// buat catatan
	rec := doJSON(t, e, http.MethodPost, "/api/cloud/notes", "u1", `{"name":"nota.md","content":"versi-1"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create note: %d %s", rec.Code, rec.Body.String())
	}
	var note map[string]any
	json.Unmarshal(rec.Body.Bytes(), &note)
	id, _ := note["id"].(string)

	// isi awal
	rec = doJSON(t, e, http.MethodGet, "/api/cloud/files/"+id+"/download", "u1", "")
	if rec.Body.String() != "versi-1" {
		t.Fatalf("isi awal salah: %q", rec.Body.String())
	}

	// update isi
	rec = doJSON(t, e, http.MethodPut, "/api/cloud/files/"+id+"/content", "u1", `{"content":"versi-2-yang-lebih-panjang"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("update content: %d %s", rec.Code, rec.Body.String())
	}
	rec = doJSON(t, e, http.MethodGet, "/api/cloud/files/"+id+"/download", "u1", "")
	if rec.Body.String() != "versi-2-yang-lebih-panjang" {
		t.Fatalf("isi setelah edit salah: %q", rec.Body.String())
	}
}

func TestCloudHandlerReorder(t *testing.T) {
	_, e := setupCloudHandler(t)
	a := uploadTestFile(t, e, "u1", "a.txt", "a")
	b := uploadTestFile(t, e, "u1", "b.txt", "b")

	// Urutan manual: b sebelum a.
	rec := doJSON(t, e, http.MethodPost, "/api/cloud/files/reorder", "u1",
		fmt.Sprintf(`{"ids":["%s","%s"]}`, b, a))
	if rec.Code != http.StatusOK {
		t.Fatalf("reorder: %d %s", rec.Code, rec.Body.String())
	}
	rec = doJSON(t, e, http.MethodGet, "/api/cloud/files?sort=manual", "u1", "")
	var files []map[string]any
	json.Unmarshal(rec.Body.Bytes(), &files)
	if len(files) != 2 || files[0]["name"] != "b.txt" {
		t.Fatalf("urutan manual salah: %+v", files)
	}
}
