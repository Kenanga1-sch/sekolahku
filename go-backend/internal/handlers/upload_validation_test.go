package handlers

import (
	"bytes"
	"mime/multipart"
	"path/filepath"
	"testing"
)

// buildMultipartFile membuat *multipart.FileHeader sungguhan di memori/disk
// agar validateUploadedFile bisa diuji seperti pemakaian nyata.
func buildMultipartFile(t *testing.T, filename string, content []byte) *multipart.FileHeader {
	t.Helper()

	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("gagal membuat form file: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("gagal menulis isi file: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("gagal menutup writer: %v", err)
	}

	r := multipart.NewReader(body, w.Boundary())
	form, err := r.ReadForm(32 << 20)
	if err != nil {
		t.Fatalf("gagal membaca form: %v", err)
	}
	fhs := form.File["file"]
	if len(fhs) == 0 {
		t.Fatal("tidak ada file di form")
	}
	return fhs[0]
}

// TestValidateUploadedFileRejectsDisguisedHTML memastikan fallback ke header
// Content-Type yang dikirim klien tidak bisa dipakai untuk menyelundupkan
// file berbahaya berlabel .png.
func TestValidateUploadedFileRejectsDisguisedHTML(t *testing.T) {
	// Isi sebenarnya HTML berbahaya.
	html := []byte(`<script>alert(1)</script><img src=x onerror=alert(1)>`)
	fh := buildMultipartFile(t, "evil.png", html)

	// Klien mengklaim ini image/png lewat header Content-Type.
	fh.Header.Set("Content-Type", "image/png")

	_, err := validateUploadedFile(fh, uploadValidationOpts{
		AllowedExtensions: []string{".png", ".jpg", ".jpeg", ".webp"},
		MaxBytes:          5 << 20,
	})
	if err == nil {
		t.Fatal("KECELAKAAN: file HTML berlabel .png diterima — fallback Content-Type masih bisa dibypass")
	}
}

// TestValidateUploadedFileAcceptsRealPNG memastikan file gambar asli tetap
// diterima (perbaikan tidak merusak fitur upload).
func TestValidateUploadedFileAcceptsRealPNG(t *testing.T) {
	// Header PNG valid (magic bytes).
	png := []byte("\x89PNG\r\n\x1a\n" + string(make([]byte, 64)))
	fh := buildMultipartFile(t, "foto.png", png)
	fh.Header.Set("Content-Type", "image/png")

	ext, err := validateUploadedFile(fh, uploadValidationOpts{
		AllowedExtensions: []string{".png", ".jpg", ".jpeg", ".webp"},
		MaxBytes:          5 << 20,
	})
	if err != nil {
		t.Fatalf("file PNG asli seharusnya diterima, got error: %v", err)
	}
	if ext != ".png" {
		t.Errorf("ext = %q, want .png", ext)
	}
}

// TestValidateUploadedFileRejectsOversize memastikan batas ukuran diterapkan.
func TestValidateUploadedFileRejectsOversize(t *testing.T) {
	png := []byte("\x89PNG\r\n\x1a\n" + string(make([]byte, 4096)))
	fh := buildMultipartFile(t, "besar.png", png)
	fh.Header.Set("Content-Type", "image/png")

	_, err := validateUploadedFile(fh, uploadValidationOpts{
		AllowedExtensions: []string{".png"},
		MaxBytes:          1024, // sengaja kecil
	})
	if err == nil {
		t.Fatal("file melebihi batas ukuran seharusnya ditolak")
	}
}

// TestValidateUploadedFileDocxMagicBytes memastikan file .docx harus punya
// magic bytes zip — bukan hanya ekstensi .docx.
func TestValidateUploadedFileDocxMagicBytes(t *testing.T) {
	// Ekstensi .docx tapi isinya HTML.
	fake := []byte("<html><script>alert(1)</script></html>")
	fh := buildMultipartFile(t, "surat.docx", fake)
	fh.Header.Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")

	_, err := validateUploadedFile(fh, uploadValidationOpts{
		AllowedExtensions: []string{".docx"},
		MaxBytes:          15 << 20,
	})
	if err == nil {
		t.Fatal("KECELAKAAN: file HTML berekstensi .docx diterima")
	}

	// .docx asli = zip (PK\x03\x04).
	real := []byte("PK\x03\x04" + string(make([]byte, 64)))
	fh2 := buildMultipartFile(t, "surat.docx", real)
	fh2.Header.Set("Content-Type", "application/zip")

	ext, err := validateUploadedFile(fh2, uploadValidationOpts{
		AllowedExtensions: []string{".docx"},
		MaxBytes:          15 << 20,
	})
	if err != nil {
		t.Fatalf("docx asli seharusnya diterima, got: %v", err)
	}
	if ext != ".docx" {
		t.Errorf("ext = %q, want .docx", ext)
	}
}

// TestValidateUploadedFileRejectsDangerousExtension memastikan ekstensi yang
// bisa dieksekusi browser (.html, .svg, .js) ditolak meski magic bytes-nya
// lolos deteksi sebagai teks.
func TestValidateUploadedFileRejectsDangerousExtension(t *testing.T) {
	// allowedMimeTypes tidak berisi text/html, jadi ini harus ditolak.
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>`)
	fh := buildMultipartFile(t, "gambar.svg", svg)
	fh.Header.Set("Content-Type", "image/svg+xml")

	_, err := validateUploadedFile(fh, uploadValidationOpts{
		AllowedExtensions: []string{".png", ".jpg", ".jpeg", ".webp", ".pdf"},
		MaxBytes:          5 << 20,
	})
	if err == nil {
		t.Fatal("file .svg seharusnya ditolak karena tidak ada di allowed list")
	}
}

// TestCleanUploadNameStripsPathTraversal memastikan nama file dibersihkan ke
// komponen terakhir sehingga tidak bisa keluar dari direktori tujuan.
func TestCleanUploadNameStripsPathTraversal(t *testing.T) {
	cases := []string{
		"../../etc/passwd",
		"/etc/passwd",
		"a/b/c.jpg",
	}
	for _, name := range cases {
		got := cleanUploadName(name)
		if filepath.Base(got) != got {
			t.Errorf("cleanUploadName(%q) = %q masih mengandung pemisah path", name, got)
		}
	}
}

// TestCleanUploadNameKeepsValidName memastikan nama normal tetap dipertahankan.
func TestCleanUploadNameKeepsValidName(t *testing.T) {
	got := cleanUploadName("raport_2025.pdf")
	if got != "raport_2025.pdf" {
		t.Errorf("cleanUploadName = %q, want raport_2025.pdf", got)
	}
}

// TestValidateUploadedFileRejectsEmpty memastikan file kosong ditolak.
func TestValidateUploadedFileRejectsEmpty(t *testing.T) {
	fh := buildMultipartFile(t, "kosong.png", []byte{})
	fh.Header.Set("Content-Type", "image/png")

	if _, err := validateUploadedFile(fh, uploadValidationOpts{
		AllowedExtensions: []string{".png"},
		MaxBytes:          5 << 20,
	}); err == nil {
		t.Fatal("file kosong seharusnya ditolak")
	}
}

// TestIsDangerousUploadExtension memastikan daftar ekstensi berbahaya
// mencakup yang bisa dieksekusi browser.
func TestIsDangerousUploadExtension(t *testing.T) {
	dangerous := []string{".html", ".htm", ".svg", ".js", ".php", ".jsp", ".xhtml"}
	for _, ext := range dangerous {
		if !isDangerousUploadExtension(ext) {
			t.Errorf("%s seharusnya dianggap berbahaya", ext)
		}
	}
	safe := []string{".png", ".jpg", ".jpeg", ".webp", ".pdf"}
	for _, ext := range safe {
		if isDangerousUploadExtension(ext) {
			t.Errorf("%s seharusnya TIDAK dianggap berbahaya", ext)
		}
	}
}
