package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/util"
)

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

// Allowed MIME types mapped to extensions
var allowedMimeTypes = map[string]string{
	"image/jpeg":      "jpg",
	"image/png":       "png",
	"image/webp":      "webp",
	"image/gif":       "gif",
	"application/pdf": "pdf",
}

// generalUploadFolders adalah folder yang boleh ditulis lewat endpoint umum
// POST /api/upload. Folder dokumen privat (spmb, alumni, arsip, eoffice,
// templates, inventory, bank-soal) sengaja dikecualikan: penulisannya hanya
// lewat handler khusus yang memvalidasi kepemilikan/konteks.
var generalUploadFolders = map[string]bool{
	"uploads":      true,
	"profiles":     true,
	"gallery":      true,
	"announcements": true,
	"staff":        true,
	"chat":         true,
	"tugas":        true,
	"logo":         true,
	"stamp":        true,
	"library":      true,
}

func isGeneralUploadFolderAllowed(folder string) bool {
	return generalUploadFolders[folder]
}

func generateSafeFilename(ext string) string {
	// ext datang dengan titik (".png"); fungsi ini menambahkan titik
	// sendiri, jadi titik ganda harus dinetralkan (dulu ".png" menjadi
	// "file..png" — valid tapi janggal).
	ext = strings.TrimPrefix(ext, ".")
	b := make([]byte, 12)
	rand.Read(b)
	return fmt.Sprintf("%d-%s.%s", time.Now().UnixMilli(), hex.EncodeToString(b), ext)
}

func resolveSharedPublicUploadsDir() string {
	candidates := []string{
		filepath.Join("..", "public", "uploads"),
		filepath.Join("public", "uploads"),
	}

	for _, candidate := range candidates {
		if info, err := os.Stat(filepath.Dir(candidate)); err == nil && info.IsDir() {
			return candidate
		}
	}

	return filepath.Join("public", "uploads")
}

// GeneralUpload handles POST /api/upload
func (h *UploadHandler) GeneralUpload(c echo.Context) error {
	// Auth check via JWT (middleware will handle this)
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No file uploaded"})
	}

	folder := c.FormValue("folder")
	if folder == "" {
		folder = "uploads"
	}

	// Validate folder name to prevent directory traversal
	if strings.Contains(folder, "..") || strings.Contains(folder, "/") || strings.Contains(folder, "\\") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid folder name"})
	}

	// Allowlist folder: tanpa ini, user manapun (termasuk siswa) bisa menulis
	// ke folder dokumen privat seperti "spmb" atau "alumni" lewat endpoint
	// umum. Penulisan ke folder privat hanya lewat handler khusus (SPMB,
	// alumni, eoffice) yang memvalidasi kepemilikan.
	if !isGeneralUploadFolderAllowed(folder) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Folder upload tidak diizinkan"})
	}

	// Max size 5MB
	if file.Size > 5*1024*1024 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File too large (max 5MB)"})
	}

	// Validate MIME type
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot open file"})
	}
	defer src.Close()

	// Read first 512 bytes for content type detection
	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	contentType := http.DetectContentType(buf[:n])
	src.Seek(0, io.SeekStart) // reset reader

	ext, ok := allowedMimeTypes[contentType]
	if !ok {
		// Hanya boleh percaya pada hasil deteksi magic bytes. Fallback ke
		// header Content-Type dari klien dihapus: header itu bisa dipalsukan,
		// sehingga file HTML berbahaya berlabel "image/png" bisa lolos.
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("Invalid file type: %s", contentType),
		})
	}

	// Create destination
	uploadDir := filepath.Join(resolveSharedPublicUploadsDir(), folder)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.Logger().Error("Failed to create upload directory:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot create upload directory"})
	}

	filename := generateSafeFilename(ext)
	dstPath := filepath.Join(uploadDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		c.Logger().Error("Failed to create file:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot save file"})
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		c.Logger().Error("Failed to write file:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot write file"})
	}
	dst.Close()

	// Resize images to reduce bandwidth
	if strings.HasPrefix(contentType, "image/") {
		util.ResizeImage(dstPath, util.DefaultResizeConfig)
	}

	publicURL := fmt.Sprintf("/uploads/%s/%s", folder, filename)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"url":     publicURL,
	})
}

// SPMBUpload handles POST /api/spmb/upload - multi-file upload for SPMB documents
// LibraryCoverUpload handles POST /api/library/catalog/cover
func (h *UploadHandler) LibraryCoverUpload(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No file uploaded"})
	}

	isbn := c.FormValue("isbn")
	catalogId := c.FormValue("catalogId")

	coverAllowed := map[string]string{
		"image/jpeg": "jpg",
		"image/png":  "png",
		"image/webp": "webp",
	}

	// Batasi ukuran upload (sama dengan GeneralUpload).
	if file.Size > 5*1024*1024 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Ukuran file melebihi batas 5 MB"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot open file"})
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	ct := http.DetectContentType(buf[:n])
	src.Seek(0, io.SeekStart)

	detectedExt, ok := coverAllowed[ct]
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid file type. Only JPG, PNG, WEBP allowed."})
	}

	uploadDir := filepath.Join("public", "uploads", "library", "covers")
	os.MkdirAll(uploadDir, 0755)

	// Gunakan ISBN atau catalogId untuk penamaan, fallback ke timestamp.
	// Sanitasi wajib: nilai form bisa mengandung traversal (../../...).
	baseName := isbn
	if baseName == "" {
		baseName = catalogId
	}
	baseName = sanitizeCoverName(baseName)
	if baseName == "" {
		baseName = fmt.Sprintf("%d", time.Now().UnixMilli())
	}
	// Ekstensi mengikuti isi file yang terdeteksi, bukan asumsi .webp.
	filename := baseName + "." + detectedExt
	dstPath := filepath.Join(uploadDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot save file"})
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan file"})
	}
	dst.Close()

	// Resize cover besar untuk menghemat bandwidth.
	if err := util.ResizeImage(dstPath, util.DefaultResizeConfig); err != nil {
		// Resize gagal tidak fatal; file asli tetap tersimpan.
		log.Printf("[LibraryCoverUpload] resize warning: %v", err)
	}

	imageURL := fmt.Sprintf("/uploads/library/covers/%s", filename)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"url":     imageURL,
	})
}

// sanitizeCoverName memastikan nama file hanya berisi karakter aman
// (alnum, dash, underscore, dot) sehingga tidak bisa keluar dari direktori
// upload. Hasil bisa kosong bila input tidak valid.
func sanitizeCoverName(name string) string {
	name = strings.TrimSpace(name)
	var b strings.Builder
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-' || r == '_':
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 64 {
		out = out[:64]
	}
	return out
}
