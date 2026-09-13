package handlers

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// Batas lampiran pesan masuk. Video bukti dari kamera HP mudah melewati
// 15MB, jadi batas dibuat longgar; rate-limit publicFormLimit + BodyLimit
// global 60MB tetap menjadi rem utama (3 file terbesar yang muat dalam
// satu request). Endpoint ini publik — angka tetap dibatasi sadar.
const (
	contactAttachmentMaxCount = 3
	contactImageMaxBytes      = int64(25 << 20) // 25 MB
	contactVideoMaxBytes      = int64(50 << 20) // 50 MB
)

// contactImageExt ekstensi gambar yang diterima, dipetakan dari MIME hasil
// deteksi magic byte.
var contactImageExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// contactVideoExt ekstensi video yang diterima. http.DetectContentType
// mengembalikan video/mp4 untuk ftyp M4A/MP4 dan video/webm untuk EBML;
// video/quicktime tidak dideteksi DetectContentType versi stdlib, jadi
// magic ISO-BMFF qt dicek terpisah di bawah.
var contactVideoExt = map[string]string{
	"video/mp4":  ".mp4",
	"video/webm": ".webm",
}

// validateContactAttachment memvalidasi satu lampiran pesan masuk.
// Aturan inti (urutan penting):
//  1. Ekstensi tidak boleh berbahaya (html/svg/js/php/... — stored XSS).
//  2. Ukuran sesuai batas per-kind (gambar 5MB, video 15MB).
//  3. Isi diverifikasi dari magic byte — header Content-Type klien
//     diabaikan total, menyamar HTML sebagai .png tidak akan lolos.
//  4. MP4 ala QuickTime (ftyp qt  ) dideteksi manual karena stdlib
//     hanya mengenal beberapa brand.
//
// Mengembalikan (fileKind "image"|"video", mime, ekstensi, error).
func validateContactAttachment(fh *multipart.FileHeader) (string, string, string, error) {
	if fh == nil {
		return "", "", "", fmt.Errorf("file tidak ditemukan")
	}
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if ext == "" {
		return "", "", "", fmt.Errorf("file harus memiliki ekstensi")
	}
	if isDangerousUploadExtension(ext) {
		return "", "", "", fmt.Errorf("ekstensi file tidak diizinkan: %s", ext)
	}
	if fh.Size == 0 {
		return "", "", "", fmt.Errorf("file kosong")
	}

	isVideoName := ext == ".mp4" || ext == ".webm" || ext == ".mov"
	limit := contactImageMaxBytes
	if isVideoName {
		limit = contactVideoMaxBytes
	}
	if fh.Size > limit {
		return "", "", "", fmt.Errorf("ukuran file melebihi batas %d MB", limit/(1<<20))
	}

	src, err := fh.Open()
	if err != nil {
		return "", "", "", fmt.Errorf("gagal membuka file: %w", err)
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	if n == 0 {
		return "", "", "", fmt.Errorf("file kosong")
	}
	head := buf[:n]

	detected := http.DetectContentType(head)

	// QuickTime/MP4 ISO-BMFF: stdlib memeriksa brand di offset 8 ("ftyp"
	// di 4..8 lalu brand di 8..12). "qt  " (QuickTime movie) tidak dikenali
	// stdlib sebagai video/mp4, jadi dicek eksplisit.
	if ext == ".mov" {
		if len(head) >= 12 && string(head[4:8]) == "ftyp" {
			return "video", "video/quicktime", ".mp4", nil
		}
		return "", "", "", fmt.Errorf("tipe file tidak diizinkan (terdeteksi: %s)", detected)
	}

	if wantExt, ok := contactImageExt[detected]; ok {
		if isVideoName {
			// Nama bilang video, isi bilang gambar — simpan sebagai gambar
			// sesuai isi (magic byte menang), ekstensi mengikuti isi supaya
			// serving by-extension konsisten.
			return "image", detected, wantExt, nil
		}
		return "image", detected, wantExt, nil
	}
	if wantExt, ok := contactVideoExt[detected]; ok {
		return "video", detected, wantExt, nil
	}

	// Gagal total: bukan gambar maupun video yang dikenali — termasuk
	// HTML/SVG/scripting yang menyamar.
	return "", "", "", fmt.Errorf("tipe file tidak diizinkan (terdeteksi: %s)", detected)
}

// saveContactAttachment menyimpan file yang sudah tervalidasi ke
// public/uploads/contact/ dengan nama acak (tidak pernah nama pengguna —
// mencegah path traversal dan kebocoran pola penamaan).
// Mengembalikan path publik (/uploads/contact/<file>) dan ukuran tertulis.
func saveContactAttachment(fh *multipart.FileHeader, ext string) (string, int64, error) {
	dir := filepath.Join(resolveSharedPublicUploadsDir(), "contact")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", 0, err
	}
	filename := generateSafeFilename(ext)
	dst, err := os.Create(filepath.Join(dir, filename))
	if err != nil {
		return "", 0, err
	}
	defer dst.Close()

	src, err := fh.Open()
	if err != nil {
		return "", 0, err
	}
	defer src.Close()

	written, err := io.Copy(dst, src)
	if err != nil {
		return "", 0, err
	}
	return "/uploads/contact/" + filename, written, nil
}
