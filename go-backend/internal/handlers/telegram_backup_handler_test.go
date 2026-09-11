package handlers

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// makeMaliciousZip membuat zip berisi entri dengan nama path berbahaya.
func makeMaliciousZip(t *testing.T, entries map[string]string) string {
	t.Helper()
	tmp := filepath.Join(t.TempDir(), "evil.zip")
	f, err := os.Create(tmp)
	if err != nil {
		t.Fatalf("gagal membuat file zip: %v", err)
	}
	defer f.Close()

	w := zip.NewWriter(f)
	for name, content := range entries {
		fw, err := w.Create(name)
		if err != nil {
			t.Fatalf("gagal membuat entri %q: %v", name, err)
		}
		if _, err := fw.Write([]byte(content)); err != nil {
			t.Fatalf("gagal menulis entri %q: %v", name, err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("gagal menutup zip writer: %v", err)
	}
	return tmp
}

// TestExtractZipRejectsAbsolutePath memastikan entri berpath absolut tidak
// dipakai apa adanya (yang bisa menimpa file di luar direktori tujuan).
func TestExtractZipRejectsAbsolutePath(t *testing.T) {
	dest := t.TempDir()
	zipPath := makeMaliciousZip(t, map[string]string{
		"/tmp/evil_absolute_pwned.txt": "pwned",
	})

	if err := extractZipSecurely(zipPath, dest); err != nil {
		t.Fatalf("extractZipSecurely mengembalikan error: %v", err)
	}

	// File absolut tidak boleh ditulis di lokasi aslinya.
	if _, err := os.Stat("/tmp/evil_absolute_pwned.txt"); err == nil {
		os.Remove("/tmp/evil_absolute_pwned.txt")
		t.Fatal("KECELAAHAN: entri absolut ditulis ke path absolut — zip-slip masih ada")
	}
}

// TestExtractZipRejectsTraversal memastikan entri "../" tidak bisa keluar
// dari direktori tujuan.
func TestExtractZipRejectsTraversal(t *testing.T) {
	dest := t.TempDir()
	// parent dari dest — entri traversal akan mendarat di sini jika rentan.
	parent := filepath.Dir(dest)

	zipPath := makeMaliciousZip(t, map[string]string{
		"../../../../../../../../tmp/evil_traversal_pwned.txt": "pwned",
		"a/b/../../../../../../../../tmp/evil_traversal2.txt":  "pwned",
	})

	if err := extractZipSecurely(zipPath, dest); err != nil {
		t.Fatalf("extractZipSecurely mengembalikan error: %v", err)
	}

	for _, name := range []string{"evil_traversal_pwned.txt", "evil_traversal2.txt"} {
		p := filepath.Join("/tmp", name)
		if _, err := os.Stat(p); err == nil {
			os.Remove(p)
			t.Fatalf("KECELAKAAN: entri traversal lolos ke %s — zip-slip masih ada", p)
		}
	}
	// Direktori parent tidak boleh berisi file baru dari zip.
	entries, _ := os.ReadDir(parent)
	for _, e := range entries {
		if strings.Contains(e.Name(), "pwned") {
			t.Fatalf("KECELAKAAN: file berbahaya muncul di parent: %s", e.Name())
		}
	}
}

// TestExtractZipWritesValidEntries memastikan entri normal tetap diekstrak
// dengan benar di bawah direktori tujuan (fungsi tidak merusak fitur).
func TestExtractZipWritesValidEntries(t *testing.T) {
	dest := t.TempDir()
	zipPath := makeMaliciousZip(t, map[string]string{
		"data/sekolahku.db":      "db-content",
		"public/uploads/a/b.jpg": "img",
	})

	if err := extractZipSecurely(zipPath, dest); err != nil {
		t.Fatalf("extractZipSecurely mengembalikan error: %v", err)
	}

	got, err := os.ReadFile(filepath.Join(dest, "data", "sekolahku.db"))
	if err != nil {
		t.Fatalf("entri valid tidak terekstrak: %v", err)
	}
	if string(got) != "db-content" {
		t.Errorf("isi tidak sesuai: got %q, want %q", got, "db-content")
	}
	if _, err := os.Stat(filepath.Join(dest, "public", "uploads", "a", "b.jpg")); err != nil {
		t.Errorf("entri bersarang tidak terekstrak: %v", err)
	}
}

// TestExtractZipRejectsSymlinkEntry memastikan entri symlink tidak dibuat
// (symlink bisa dipakai untuk menulis keluar dari direktori tujuan).
func TestExtractZipRejectsSymlinkEntry(t *testing.T) {
	dest := t.TempDir()
	target := filepath.Join(t.TempDir(), "outside.txt")
	if err := os.WriteFile(target, []byte("original"), 0o644); err != nil {
		t.Fatalf("gagal membuat file target: %v", err)
	}

	tmp := filepath.Join(t.TempDir(), "symlink.zip")
	f, _ := os.Create(tmp)
	w := zip.NewWriter(f)
	hdr := &zip.FileHeader{Name: "link.txt", Method: zip.Deflate}
	// Mode symlink (mirip zip.FileInfoHeader untuk os.ModeSymlink).
	hdr.SetMode(os.ModeSymlink | 0o777)
	fw, err := w.CreateHeader(hdr)
	if err != nil {
		t.Fatalf("gagal membuat header symlink: %v", err)
	}
	fw.Write([]byte(target))
	w.Close()
	f.Close()

	if err := extractZipSecurely(tmp, dest); err != nil {
		t.Fatalf("extractZipSecurely mengembalikan error: %v", err)
	}

	// Symlink tidak boleh tercipta.
	if fi, err := os.Lstat(filepath.Join(dest, "link.txt")); err == nil {
		if fi.Mode()&os.ModeSymlink != 0 {
			t.Fatal("KECELAKAAN: entri symlink dibuat — bisa dipakai menulis di luar dest")
		}
	}
}

// TestExtractZipFileModeNotWorldWritable memastikan file hasil ekstraksi
// tidakworld-writable (sebelumnya memakai f.Mode() mentah + os.ModePerm).
func TestExtractZipFileModeNotWorldWritable(t *testing.T) {
	dest := t.TempDir()
	tmp := filepath.Join(t.TempDir(), "mode.zip")
	f, _ := os.Create(tmp)
	w := zip.NewWriter(f)
	hdr := &zip.FileHeader{Name: "data/x.db", Method: zip.Deflate}
	hdr.SetMode(0o777) // mode berbahaya dari zip
	fw, _ := w.CreateHeader(hdr)
	fw.Write([]byte("x"))
	w.Close()
	f.Close()

	if err := extractZipSecurely(tmp, dest); err != nil {
		t.Fatalf("extractZipSecurely mengembalikan error: %v", err)
	}

	fi, err := os.Stat(filepath.Join(dest, "data", "x.db"))
	if err != nil {
		t.Fatalf("file tidak terekstrak: %v", err)
	}
	if fi.Mode().Perm()&0o022 != 0 {
		t.Errorf("file world-writable: %v", fi.Mode().Perm())
	}
}
