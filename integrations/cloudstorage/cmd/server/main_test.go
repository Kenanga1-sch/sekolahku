package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"

	"cloudstorage/internal/config"
	"cloudstorage/internal/model"
	"cloudstorage/internal/repository"
)

func newTestApp(t *testing.T, authToken string) (*fiber.App, *repository.Repository) {
	t.Helper()
	tmpFile, err := os.CreateTemp("", "int_test_*.db")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	t.Cleanup(func() { os.Remove(tmpPath) })

	db := repository.InitDB(tmpPath)
	app := buildApp(&config.Config{AuthToken: authToken}, db)
	return app, repository.NewRepository(db)
}

func doRequest(app *fiber.App, method, path, body string, headers map[string]string) *http.Response {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req, 15000)
	if err != nil {
		panic(err)
	}
	return resp
}

func TestListAndCreateFolderViaAPI(t *testing.T) {
	app, repo := newTestApp(t, "")

	resp := doRequest(app, "POST", "/api/folders", `{"name":"Dokumen"}`, map[string]string{"Content-Type": "application/json"})
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 creating folder, got %d", resp.StatusCode)
	}
	var created model.File
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode folder: %v", err)
	}
	if !created.IsFolder || created.Name != "Dokumen" {
		t.Fatalf("unexpected folder: %+v", created)
	}

	resp = doRequest(app, "GET", "/api/files", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 listing files, got %d", resp.StatusCode)
	}
	var files []model.File
	if err := json.NewDecoder(resp.Body).Decode(&files); err != nil {
		t.Fatalf("failed to decode files: %v", err)
	}
	if len(files) != 1 || files[0].ID != created.ID {
		t.Fatalf("expected folder in list, got %+v", files)
	}

	// Rename
	resp = doRequest(app, "PUT", "/api/files/"+created.ID, `{"name":"Baru"}`, map[string]string{"Content-Type": "application/json"})
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 renaming, got %d", resp.StatusCode)
	}

	// Trash + restore + permanent delete
	if resp = doRequest(app, "DELETE", "/api/files/"+created.ID, "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 deleting, got %d", resp.StatusCode)
	}
	if resp = doRequest(app, "POST", "/api/trash/"+created.ID+"/restore", "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 restoring, got %d", resp.StatusCode)
	}
	if resp = doRequest(app, "DELETE", "/api/files/"+created.ID, "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 deleting again, got %d", resp.StatusCode)
	}
	if resp = doRequest(app, "DELETE", "/api/trash/"+created.ID, "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 permanent delete, got %d", resp.StatusCode)
	}
	if _, err := repo.GetFileAny(created.ID); err == nil {
		t.Fatalf("expected row removed after permanent delete")
	}
}

func TestShareRoutes(t *testing.T) {
	app, _ := newTestApp(t, "")

	resp := doRequest(app, "POST", "/api/folders", `{"name":"Shared"}`, map[string]string{"Content-Type": "application/json"})
	var folder model.File
	_ = json.NewDecoder(resp.Body).Decode(&folder)

	resp = doRequest(app, "POST", "/api/files/"+folder.ID+"/share", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 creating share link, got %d", resp.StatusCode)
	}
	var share struct {
		ShareToken string `json:"share_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&share); err != nil {
		t.Fatalf("failed to decode share: %v", err)
	}
	if share.ShareToken == "" {
		t.Fatalf("expected non-empty share token")
	}

	// Halaman publik
	resp = doRequest(app, "GET", "/s/"+share.ShareToken, "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 shared page, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !bytes.Contains(body, []byte("Download File")) {
		t.Errorf("expected download button in shared page")
	}

	// Download publik: file tanpa file_id -> harus sampai handler kami (bukan
	// fallback static "Not Found"), sehingga body-nya pesan khusus handler.
	resp = doRequest(app, "GET", "/s/"+share.ShareToken+"/download", "", nil)
	body, _ = io.ReadAll(resp.Body)
	if resp.StatusCode != 404 {
		t.Fatalf("expected 404 from shared download handler, got %d", resp.StatusCode)
	}
	if strings.TrimSpace(string(body)) != "File not found on telegram" {
		t.Errorf("expected handler message, got %q (route mungkin salah)", string(body))
	}

	// Revoke
	resp = doRequest(app, "DELETE", "/api/files/"+folder.ID+"/share", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 revoking share, got %d", resp.StatusCode)
	}
	resp = doRequest(app, "GET", "/s/"+share.ShareToken, "", nil)
	if resp.StatusCode != 404 {
		t.Fatalf("expected 404 after revoke, got %d", resp.StatusCode)
	}
}

func TestAuthMiddleware(t *testing.T) {
	app, _ := newTestApp(t, "secret-token")

	// Tanpa token -> 401 untuk API
	resp := doRequest(app, "GET", "/api/files", "", nil)
	if resp.StatusCode != 401 {
		t.Fatalf("expected 401 without token, got %d", resp.StatusCode)
	}

	// Dengan token -> 200
	resp = doRequest(app, "GET", "/api/files", "", map[string]string{"Authorization": "Bearer secret-token"})
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 with token, got %d", resp.StatusCode)
	}

	// Query token tidak lagi diterima (demi keamanan, token tidak di URL)
	resp = doRequest(app, "GET", "/api/files?token=secret-token", "", nil)
	if resp.StatusCode != 401 {
		t.Fatalf("expected 401 with query token, got %d", resp.StatusCode)
	}

	// Cookie token diterima
	resp = doRequest(app, "GET", "/api/files", "", map[string]string{"Cookie": "token=secret-token"})
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 with cookie token, got %d", resp.StatusCode)
	}

	// Token salah -> 401
	resp = doRequest(app, "GET", "/api/files", "", map[string]string{"Authorization": "Bearer wrong"})
	if resp.StatusCode != 401 {
		t.Fatalf("expected 401 with wrong token, got %d", resp.StatusCode)
	}

	// Halaman non-API diarahkan ke /login
	resp = doRequest(app, "GET", "/", "", nil)
	if resp.StatusCode != 302 {
		t.Fatalf("expected redirect to /login, got %d", resp.StatusCode)
	}
	if loc := resp.Header.Get("Location"); loc != "/login" {
		t.Fatalf("expected redirect location /login, got %s", loc)
	}

	// /login publik
	resp = doRequest(app, "GET", "/login", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 login page, got %d", resp.StatusCode)
	}

	// /s/:token publik (tidak diarahkan ke login)
	resp = doRequest(app, "GET", "/s/anything", "", nil)
	if resp.StatusCode != 404 {
		t.Fatalf("expected 404 from share page (public), got %d", resp.StatusCode)
	}
}

func TestLoginEndpoint(t *testing.T) {
	app, _ := newTestApp(t, "secret-token")

	// Token benar -> 200
	resp := doRequest(app, "POST", "/api/login", `{"token":"secret-token"}`, map[string]string{"Content-Type": "application/json"})
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 login with correct token, got %d", resp.StatusCode)
	}

	// Token salah -> 401
	resp = doRequest(app, "POST", "/api/login", `{"token":"wrong"}`, map[string]string{"Content-Type": "application/json"})
	if resp.StatusCode != 401 {
		t.Fatalf("expected 401 login with wrong token, got %d", resp.StatusCode)
	}

	// Body rusak -> 400
	resp = doRequest(app, "POST", "/api/login", `not-json`, map[string]string{"Content-Type": "application/json"})
	if resp.StatusCode != 400 {
		t.Fatalf("expected 400 login with invalid body, got %d", resp.StatusCode)
	}
}

func TestLoginRateLimit(t *testing.T) {
	app, _ := newTestApp(t, "secret-token")

	// 11 percobaan berturut (max 10/menit) -> percobaan terakhir 429
	last := 0
	for i := 0; i < 11; i++ {
		resp := doRequest(app, "POST", "/api/login", `{"token":"wrong"}`, map[string]string{"Content-Type": "application/json"})
		last = resp.StatusCode
	}
	if last != 429 {
		t.Fatalf("expected 429 after rate limit, got %d", last)
	}
}

func TestCSRFMiddleware(t *testing.T) {
	app, _ := newTestApp(t, "")

	// Tanpa header Origin -> diizinkan
	resp := doRequest(app, "POST", "/api/folders", `{"name":"X"}`, map[string]string{"Content-Type": "application/json"})
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 without Origin, got %d", resp.StatusCode)
	}

	// Origin asing -> 403
	resp = doRequest(app, "POST", "/api/folders", `{"name":"Y"}`, map[string]string{"Content-Type": "application/json", "Origin": "http://evil.example.com"})
	if resp.StatusCode != 403 {
		t.Fatalf("expected 403 for foreign origin, got %d", resp.StatusCode)
	}

	// Origin sesuai host server -> 200
	resp = doRequest(app, "POST", "/api/folders", `{"name":"Z"}`, map[string]string{"Content-Type": "application/json", "Origin": "http://example.com"})
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 for same-origin, got %d", resp.StatusCode)
	}

	// GET dengan Origin asing tetap diizinkan (tidak mengubah state)
	resp = doRequest(app, "GET", "/api/files", "", map[string]string{"Origin": "http://evil.example.com"})
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 for GET with foreign origin, got %d", resp.StatusCode)
	}
}

func TestBackupDatabase(t *testing.T) {
	dir := t.TempDir()
	srcPath := filepath.Join(dir, "src.db")
	destPath := filepath.Join(dir, "backup.db")

	db := repository.InitDB(srcPath)
	repo := repository.NewRepository(db)
	createRow(t, repo, "a.txt", false, nil)
	createRow(t, repo, "folder", true, nil)

	if err := backupDatabase(db, destPath); err != nil {
		t.Fatalf("backup failed: %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("failed to close source db: %v", err)
	}

	backupDB := repository.InitDB(destPath)
	defer backupDB.Close()
	backupRepo := repository.NewRepository(backupDB)
	files, err := backupRepo.ListFiles(nil)
	if err != nil {
		t.Fatalf("failed to list backed up files: %v", err)
	}
	if len(files) != 2 {
		t.Fatalf("expected 2 files in backup, got %d", len(files))
	}
}

func TestListFilesPagination(t *testing.T) {
	app, repo := newTestApp(t, "")
	for i := 0; i < 25; i++ {
		createRow(t, repo, fmt.Sprintf("file-%d.txt", i), false, nil)
	}

	resp := doRequest(app, "GET", "/api/files?limit=10", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var files []model.File
	if err := json.NewDecoder(resp.Body).Decode(&files); err != nil {
		t.Fatalf("failed to decode files: %v", err)
	}
	if len(files) != 10 {
		t.Errorf("expected 10 items on first page, got %d", len(files))
	}
	if resp.Header.Get("X-Total-Count") != "25" {
		t.Errorf("expected X-Total-Count 25, got %q", resp.Header.Get("X-Total-Count"))
	}
	if resp.Header.Get("X-Has-More") != "true" {
		t.Errorf("expected X-Has-More true, got %q", resp.Header.Get("X-Has-More"))
	}

	resp = doRequest(app, "GET", "/api/files?limit=10&offset=20", "", nil)
	files = nil
	if err := json.NewDecoder(resp.Body).Decode(&files); err != nil {
		t.Fatalf("failed to decode files: %v", err)
	}
	if len(files) != 5 {
		t.Errorf("expected 5 items on last page, got %d", len(files))
	}
	if resp.Header.Get("X-Has-More") != "false" {
		t.Errorf("expected X-Has-More false, got %q", resp.Header.Get("X-Has-More"))
	}
}

func TestNoAuthWhenTokenEmpty(t *testing.T) {
	app, _ := newTestApp(t, "")

	resp := doRequest(app, "GET", "/api/config", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 config, got %d", resp.StatusCode)
	}
	var cfg struct {
		AuthRequired bool `json:"auth_required"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&cfg)
	if cfg.AuthRequired {
		t.Fatalf("expected auth_required false when no AUTH_TOKEN")
	}

	// Static served tanpa auth
	resp = doRequest(app, "GET", "/", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 index, got %d", resp.StatusCode)
	}
}

var rowSeq int64

func createRow(t *testing.T, repo *repository.Repository, name string, isFolder bool, parentID *string) string {
	t.Helper()
	rowSeq++
	id := fmt.Sprintf("row-%d-%d", time.Now().UnixNano(), rowSeq)
	now := time.Now().Unix()
	f := &model.File{
		ID:        id,
		Name:      name,
		ParentID:  parentID,
		IsFolder:  isFolder,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := repo.CreateFile(f); err != nil {
		t.Fatalf("failed to create row: %v", err)
	}
	return id
}

func TestTrash_RestoreAllAndEmpty(t *testing.T) {
	app, repo := newTestApp(t, "")

	folder := createRow(t, repo, "folder", true, nil)
	child := createRow(t, repo, "child.txt", false, &folder)
	orphan := createRow(t, repo, "orphan.txt", false, nil)

	// Soft delete folder (cascade) + orphan
	if resp := doRequest(app, "DELETE", "/api/files/"+folder, "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 delete folder, got %d", resp.StatusCode)
	}
	if resp := doRequest(app, "DELETE", "/api/files/"+orphan, "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 delete orphan, got %d", resp.StatusCode)
	}

	trash := getTrashIDs(t, app)
	if !trash[folder] || !trash[child] || !trash[orphan] {
		t.Fatalf("expected 3 items in trash, got %v", trash)
	}

	// Restore all
	if resp := doRequest(app, "POST", "/api/trash/restore-all", "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 restore-all, got %d", resp.StatusCode)
	}
	if trash = getTrashIDs(t, app); len(trash) != 0 {
		t.Fatalf("expected empty trash after restore-all, got %v", trash)
	}
	// Child kembali bersama parent
	files, err := repo.ListFiles(&folder)
	if err != nil {
		t.Fatalf("failed to list folder: %v", err)
	}
	if len(files) != 1 || files[0].ID != child {
		t.Fatalf("expected child restored under folder, got %+v", files)
	}

	// Hapus lagi lalu empty trash
	if resp := doRequest(app, "DELETE", "/api/files/"+folder, "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 delete folder again, got %d", resp.StatusCode)
	}
	if resp := doRequest(app, "DELETE", "/api/files/"+orphan, "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 delete orphan again, got %d", resp.StatusCode)
	}
	if resp := doRequest(app, "DELETE", "/api/trash", "", nil); resp.StatusCode != 200 {
		t.Fatalf("expected 200 empty trash, got %d", resp.StatusCode)
	}
	if trash = getTrashIDs(t, app); len(trash) != 0 {
		t.Fatalf("expected trash empty, got %v", trash)
	}
	if _, err := repo.GetFileAny(folder); err == nil {
		t.Fatalf("expected folder row removed after empty trash")
	}
	if _, err := repo.GetFileAny(child); err == nil {
		t.Fatalf("expected child row removed after empty trash")
	}
	if _, err := repo.GetFileAny(orphan); err == nil {
		t.Fatalf("expected orphan row removed after empty trash")
	}
}

func getTrashIDs(t *testing.T, app *fiber.App) map[string]bool {
	t.Helper()
	resp := doRequest(app, "GET", "/api/trash", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 trash, got %d", resp.StatusCode)
	}
	var files []model.File
	if err := json.NewDecoder(resp.Body).Decode(&files); err != nil {
		t.Fatalf("failed to decode trash: %v", err)
	}
	set := map[string]bool{}
	for _, f := range files {
		set[f.ID] = true
	}
	return set
}
