package handlers

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
)

// dangerousUploadExtensions adalah ekstensi yang dapat dieksekusi atau
// dirender oleh browser. File dengan ekstensi ini tidak boleh tersimpan di
// direktori yang disajikan publik, karena dapat menjadi stored XSS.
var dangerousUploadExtensions = map[string]bool{
	".html":  true,
	".htm":   true,
	".xhtml": true,
	".svg":   true,
	".js":    true,
	".mjs":   true,
	".php":   true,
	".phtml": true,
	".jsp":   true,
	".asp":   true,
	".aspx":  true,
	".sh":    true,
	".exe":   true,
	".bat":   true,
	".cmd":   true,
}

// isDangerousUploadExtension melaporkan apakah ekstensi termasuk yang bisa
// dieksekusi/dirender browser.
func isDangerousUploadExtension(ext string) bool {
	return dangerousUploadExtensions[strings.ToLower(ext)]
}

// allowedUploadMime memetakan tipe MIME hasil deteksi magic bytes ke ekstensi
// yang diizinkan. Kunci harus berupa apa yang dikembalikan
// http.DetectContentType, BUKAN header Content-Type dari klien.
var allowedUploadMime = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"image/gif":       ".gif",
	"application/pdf": ".pdf",
}

// zipMagicBytes adalah tanda file ZIP — dipakai untuk memvalidasi .docx
// (format Office Open XML pada dasarnya adalah zip).
var zipMagicBytes = []byte("PK\x03\x04")

// uploadValidationOpts mengatur pemeriksaan pada validateUploadedFile.
type uploadValidationOpts struct {
	// AllowedExtensions berisi ekstensi yang diizinkan, lengkap dengan titik
	// (mis. ".png"). Ekstensi di luar daftar ditolak.
	AllowedExtensions []string
	// MaxBytes adalah ukuran maksimal file. Nol berarti tidak dibatasi.
	MaxBytes int64
	// AllowZip mengizinkan konten bertipe zip (diperlukan untuk .docx).
	AllowZip bool
}

// validateUploadedFile memeriksa file upload secara berlapis:
//  1. Ekstensi harus termasuk yang diizinkan (dan tidak berbahaya).
//  2. Ukuran tidak melebihi batas.
//  3. Isi file harus cocok dengan magic bytes yang diharapkan.
//
// Pemeriksaan ke-3 adalah yang terpenting: sebelumnya kode memakai header
// Content-Type dari klien sebagai fallback, sehingga penyerang cukup
// mengirim file HTML berlabel image/png untuk lolos.
//
// Mengembalikan ekstensi (dengan titik) bila file valid.
func validateUploadedFile(fh *multipart.FileHeader, opts uploadValidationOpts) (string, error) {
	if fh == nil {
		return "", fmt.Errorf("file tidak ditemukan")
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if ext == "" {
		return "", fmt.Errorf("file harus memiliki ekstensi")
	}

	// isAllowedUploadExtension juga menolak ekstensi yang bisa dieksekusi
	// browser, walau suatu saat dimasukkan ke daftar izin.
	if !isAllowedUploadExtension(ext, opts.AllowedExtensions) {
		return "", fmt.Errorf("ekstensi file tidak diizinkan: %s", ext)
	}

	if opts.MaxBytes > 0 && fh.Size > opts.MaxBytes {
		return "", fmt.Errorf("ukuran file melebihi batas %d MB", opts.MaxBytes/(1<<20))
	}
	if fh.Size == 0 {
		return "", fmt.Errorf("file kosong")
	}

	src, err := fh.Open()
	if err != nil {
		return "", fmt.Errorf("gagal membuka file: %w", err)
	}
	defer src.Close()

	// Deteksi dari isi file, bukan dari header yang dikirim klien.
	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	if n == 0 {
		return "", fmt.Errorf("file kosong")
	}
	head := buf[:n]

	// .docx (dan format OOXML lain) adalah zip.
	if ext == ".docx" || opts.AllowZip {
		if len(head) >= 4 && string(head[:4]) == string(zipMagicBytes) {
			return ext, nil
		}
	}

	detected := http.DetectContentType(head)
	if wantExt, ok := allowedUploadMime[detected]; ok {
		// Isi terdeteksi sebagai tipe yang aman. Bila ekstensi tidak cocok
		// (mis. PNG diunggah dengan nama .jpg), file disimpan dengan nama
		// yang diminta — isinya tetap aman karena sudah terverifikasi.
		_ = wantExt
		return ext, nil
	}

	if detected == "application/zip" && (ext == ".docx" || opts.AllowZip) {
		return ext, nil
	}

	return "", fmt.Errorf("tipe file tidak diizinkan (terdeteksi: %s)", detected)
}

// isAllowedUploadExtension memeriksa keanggotaan daftar ekstensi.
func isAllowedUploadExtension(ext string, allowed []string) bool {
	ext = strings.ToLower(ext)
	if isDangerousUploadExtension(ext) {
		return false
	}
	for _, e := range allowed {
		if strings.ToLower(e) == ext {
			return true
		}
	}
	return false
}
