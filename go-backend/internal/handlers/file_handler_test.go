package handlers

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

// setupFileTestEnv membuat direktori public/uploads sementara berisi satu
// file di folder privat (spmb) dan satu di folder publik (gallery), lalu
// mengembalikan root-nya. Dipakai oleh TestFileHandler*.
func setupFileTestEnv(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	pubUploads := filepath.Join(root, "public", "uploads")
	for _, d := range []string{"spmb", "gallery"} {
		if err := os.MkdirAll(filepath.Join(pubUploads, d), 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", d, err)
		}
	}
	if err := os.WriteFile(filepath.Join(pubUploads, "spmb", "kk.pdf"), []byte("PRIVATE"), 0o644); err != nil {
		t.Fatalf("write spmb file: %v", err)
	}
	if err := os.WriteFile(filepath.Join(pubUploads, "gallery", "foto.jpg"), []byte("PUBLIC"), 0o644); err != nil {
		t.Fatalf("write gallery file: %v", err)
	}
	return root
}

// newFileContext membuat Echo context dengan role tertentu ("" = anonim).
func newFileContext(role, pathParam string) (echo.Context, *httptest.ResponseRecorder) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPath("/api/files/*")
	c.SetParamNames("*")
	c.SetParamValues(pathParam)
	if role != "" {
		c.Set("user_role", role)
	}
	return c, rec
}

func TestIsPublicUploadPath(t *testing.T) {
	cases := []struct {
		rel  string
		want bool
	}{
		{"gallery/a.jpg", true},
		{"staff/x.webp", true},
		{"announcements/n.jpg", true},
		{"library/covers/b.png", true},
		{"logo/l.png", true},
		{"stamp/s.png", true},
		{"spmb/abc/kk.pdf", false},
		{"alumni/x/ijazah.pdf", false},
		{"arsip/surat.pdf", false},
		{"chat/m.pdf", false},
		{"", false},
		{".", false},
		{"../etc/passwd", false},
	}
	for _, tc := range cases {
		if got := IsPublicUploadPath(tc.rel); got != tc.want {
			t.Errorf("isPublicUploadPath(%q) = %v, want %v", tc.rel, got, tc.want)
		}
	}
}

func TestFileHandlerRejectsAnonymous(t *testing.T) {
	root := setupFileTestEnv(t)
	defer os.RemoveAll(root)

	// Chdir ke root supaya resolveStoredFilePath (relatif "public/uploads")
	// menemukan file. Test lain di package ini juga bergantung pada CWD.
	old, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(root); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	defer os.Chdir(old)

	h := NewFileHandler()
	c, rec := newFileContext("", "/uploads/spmb/kk.pdf")
	if err := h.ServeFile(c); err != nil {
		t.Fatalf("ServeFile error: %v", err)
	}
	if rec.Code != http.StatusForbidden {
		t.Errorf("anonim: expected 403, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestFileHandlerServesAuthorizedRole(t *testing.T) {
	root := setupFileTestEnv(t)
	defer os.RemoveAll(root)

	old, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(root); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	defer os.Chdir(old)

	h := NewFileHandler()

	// staff boleh baca folder spmb.
	c, rec := newFileContext("staff", "/uploads/spmb/kk.pdf")
	if err := h.ServeFile(c); err != nil {
		t.Fatalf("ServeFile error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("staff+spmb: expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "PRIVATE") {
		t.Errorf("expected file content, got %q", rec.Body.String())
	}

	// siswa TIDAK boleh baca folder spmb.
	c2, rec2 := newFileContext("siswa", "/uploads/spmb/kk.pdf")
	if err := h.ServeFile(c2); err != nil {
		t.Fatalf("ServeFile error: %v", err)
	}
	if rec2.Code != http.StatusForbidden {
		t.Errorf("siswa+spmb: expected 403, got %d", rec2.Code)
	}

	// admin boleh baca folder alumni (folder spmb ada di matriks; alumni
	// hanya superadmin/admin — cek penegakan matriks).
	c3, rec3 := newFileContext("guru", "/uploads/spmb/kk.pdf")
	if err := h.ServeFile(c3); err != nil {
		t.Fatalf("ServeFile error: %v", err)
	}
	if rec3.Code != http.StatusForbidden {
		t.Errorf("guru+spmb: expected 403, got %d", rec3.Code)
	}
}

func TestFileHandlerRejectsPublicFolderViaAPI(t *testing.T) {
	// Folder publik harus diakses via /uploads/*, bukan /api/files/*.
	// Memanggil /api/files/uploads/gallery/... harus ditolak.
	root := setupFileTestEnv(t)
	defer os.RemoveAll(root)

	old, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(root); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	defer os.Chdir(old)

	h := NewFileHandler()
	c, rec := newFileContext("admin", "/uploads/gallery/foto.jpg")
	if err := h.ServeFile(c); err != nil {
		t.Fatalf("ServeFile error: %v", err)
	}
	if rec.Code != http.StatusForbidden {
		t.Errorf("public folder via /api/files: expected 403, got %d", rec.Code)
	}
}

func TestFileHandlerRejectsTraversal(t *testing.T) {
	root := setupFileTestEnv(t)
	defer os.RemoveAll(root)

	old, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(root); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	defer os.Chdir(old)

	h := NewFileHandler()
	// Path traversal harus ditolak oleh resolveStoredFilePath.
	c, rec := newFileContext("admin", "/uploads/spmb/../../../../data/sekolahku.db")
	if err := h.ServeFile(c); err != nil {
		t.Fatalf("ServeFile error: %v", err)
	}
	// Setelah Clean, path keluar dari folder privat apa pun, jadi bisa
	// ditolak di gate folder (403) maupun di resolve (404). Keduanya aman.
	if rec.Code != http.StatusNotFound && rec.Code != http.StatusBadRequest && rec.Code != http.StatusForbidden {
		t.Errorf("traversal: expected 404/400/403, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}
