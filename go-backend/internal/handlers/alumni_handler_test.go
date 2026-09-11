package handlers

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestResolveStoredFilePathRejectsTraversal memastikan path tersimpan yang
// mengandung traversal tidak bisa dipakai untuk keluar dari direktori upload.
// Sebelumnya nilai ini diteruskan langsung ke os.Remove — sehingga file
// sembarang (termasuk database) bisa dihapus.
func TestResolveStoredFilePathRejectsTraversal(t *testing.T) {
	cases := []string{
		"../../data/sekolahku.db",
		"/uploads/../../../data/sekolahku.db",
		"uploads/../../data/sekolahku.db",
		"../../../../../../etc/passwd",
		"/etc/passwd",
		"../../../go-backend/cmd/api/main.go",
	}

	for _, stored := range cases {
		_, ok := resolveStoredFilePath(stored)
		if ok {
			t.Errorf("resolveStoredFilePath(%q) seharusnya DITOLAK, tapi diterima", stored)
		}
	}
}

// TestResolveStoredFilePathAcceptsValidUploads memastikan path upload normal
// tetap berfungsi (perbaikan tidak merusak fitur hapus foto/dokumen).
func TestResolveStoredFilePathAcceptsValidUploads(t *testing.T) {
	cases := map[string]string{
		"/uploads/alumni/photos/123_photo.jpg": filepath.Join("public", "uploads", "alumni", "photos", "123_photo.jpg"),
		"uploads/alumni/docs/9_ijazah.pdf":     filepath.Join("public", "uploads", "alumni", "docs", "9_ijazah.pdf"),
		"public/uploads/alumni/x.jpg":          filepath.Join("public", "uploads", "alumni", "x.jpg"),
	}

	for stored, want := range cases {
		got, ok := resolveStoredFilePath(stored)
		if !ok {
			t.Errorf("resolveStoredFilePath(%q) seharusnya diterima", stored)
			continue
		}
		if got != want {
			t.Errorf("resolveStoredFilePath(%q) = %q, want %q", stored, got, want)
		}
	}
}

// TestResolveStoredFilePathStaysUnderPublicUploads adalah pengujian menyeluruh:
// berapapun jumlah "..", hasil akhir tidak boleh keluar dari direktori dasar.
func TestResolveStoredFilePathStaysUnderPublicUploads(t *testing.T) {
	// Path yang sangat dalam untuk memastikan tidak ada yang lolos.
	deep := "uploads/" + strings.Repeat("../", 20) + "data/sekolahku.db"
	if got, ok := resolveStoredFilePath(deep); ok {
		t.Errorf("path traversal dalam seharusnya ditolak, got %q", got)
	}

	// Hasil yang diterima harus selalu berada di bawah public/uploads.
	for _, stored := range []string{
		"/uploads/a/b/c.jpg",
		"uploads/a/b/c.jpg",
		"public/uploads/a/b/c.jpg",
	} {
		got, ok := resolveStoredFilePath(stored)
		if !ok {
			t.Fatalf("path valid ditolak: %q", stored)
		}
		base, err := filepath.Abs("public/uploads")
		if err != nil {
			t.Fatal(err)
		}
		abs, err := filepath.Abs(got)
		if err != nil {
			t.Fatal(err)
		}
		rel, err := filepath.Rel(base, abs)
		if err != nil || strings.HasPrefix(rel, "..") {
			t.Errorf("hasil %q berada di luar %s", got, base)
		}
	}
}

// TestSafeRemoveUploadFile memastikan helper penghapus tidak pernah menghapus
// file di luar direktori upload — diuji dengan file sungguhan.
func TestSafeRemoveUploadFile(t *testing.T) {
	// Siapkan direktori upload palsu di temp.
	base := t.TempDir()
	uploadRoot := filepath.Join(base, "public", "uploads")
	if err := os.MkdirAll(filepath.Join(uploadRoot, "alumni"), 0o755); err != nil {
		t.Fatalf("gagal membuat direktori: %v", err)
	}

	// File sah di dalam upload — boleh dihapus.
	inside := filepath.Join(uploadRoot, "alumni", "foto.jpg")
	if err := os.WriteFile(inside, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	// File di luar upload — tidak boleh terhapus.
	outside := filepath.Join(base, "data", "sekolahku.db")
	if err := os.MkdirAll(filepath.Dir(outside), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(outside, []byte("db"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Hapus file sah.
	if err := safeRemoveUploadFile(inside, uploadRoot); err != nil {
		t.Errorf("gagal menghapus file di dalam upload: %v", err)
	}
	if _, err := os.Stat(inside); err == nil {
		t.Error("file di dalam upload seharusnya terhapus")
	}

	// Percobaan hapus file di luar harus ditolak.
	if err := safeRemoveUploadFile(outside, uploadRoot); err == nil {
		t.Error("penghapusan file di luar upload seharusnya ditolak")
	}
	if _, err := os.Stat(outside); err != nil {
		t.Fatal("KECELAKAAN: file di luar upload terhapus — path traversal masih ada")
	}
}
