package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
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

func generateSafeFilename(ext string) string {
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
		// Also check the declared content type as fallback
		ext, ok = allowedMimeTypes[file.Header.Get("Content-Type")]
		if !ok {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("Invalid file type: %s", contentType),
			})
		}
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
func (h *UploadHandler) SPMBUpload(c echo.Context) error {
	registrantId := c.QueryParam("id")
	if registrantId == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID pendaftar diperlukan"})
	}

	form, err := c.MultipartForm()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid form data"})
	}

	files := form.File["documents"]
	types := form.Value["types"]

	if len(files) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tidak ada file yang diunggah"})
	}

	spmbAllowed := map[string]string{
		"application/pdf": "pdf",
		"image/jpeg":      "jpg",
		"image/png":       "png",
	}

	type DocumentFile struct {
		Path         string `json:"path"`
		Type         string `json:"type"`
		OriginalName string `json:"originalName"`
	}

	var savedFiles []DocumentFile
	var uploadErrors []string

	uploadDir := filepath.Join("public", "uploads", "spmb", registrantId)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot create directory"})
	}

	for i, fh := range files {
		if fh.Size > 2*1024*1024 {
			uploadErrors = append(uploadErrors, fmt.Sprintf("File %s melebihi ukuran maksimal 2MB", fh.Filename))
			continue
		}

		src, err := fh.Open()
		if err != nil {
			uploadErrors = append(uploadErrors, fmt.Sprintf("File %s: gagal membuka", fh.Filename))
			continue
		}

		buf := make([]byte, 512)
		n, _ := src.Read(buf)
		ct := http.DetectContentType(buf[:n])
		src.Seek(0, io.SeekStart)

		ext, ok := spmbAllowed[ct]
		if !ok {
			ext, ok = spmbAllowed[fh.Header.Get("Content-Type")]
		}
		if !ok {
			uploadErrors = append(uploadErrors, fmt.Sprintf("Format file %s tidak didukung", fh.Filename))
			src.Close()
			continue
		}

		filename := generateSafeFilename(ext)
		dstPath := filepath.Join(uploadDir, filename)

		dst, err := os.Create(dstPath)
		if err != nil {
			uploadErrors = append(uploadErrors, fmt.Sprintf("File %s: gagal menyimpan", fh.Filename))
			src.Close()
			continue
		}

		io.Copy(dst, src)
		src.Close()
		dst.Close()

		docType := "other"
		if i < len(types) {
			docType = types[i]
		}

		savedFiles = append(savedFiles, DocumentFile{
			Path:         fmt.Sprintf("/uploads/spmb/%s/%s", registrantId, filename),
			Type:         docType,
			OriginalName: fh.Filename,
		})
	}

	if len(savedFiles) == 0 && len(uploadErrors) > 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   strings.Join(uploadErrors, ", "),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"id":              registrantId,
			"documents_count": len(savedFiles),
			"new_files":       savedFiles,
			"uploaded_at":     time.Now().Format(time.RFC3339),
		},
	})
}

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

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot open file"})
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	ct := http.DetectContentType(buf[:n])
	src.Seek(0, io.SeekStart)

	_, ok := coverAllowed[ct]
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid file type. Only JPG, PNG, WEBP allowed."})
	}

	uploadDir := filepath.Join("public", "uploads", "library", "covers")
	os.MkdirAll(uploadDir, 0755)

	// Use ISBN or catalogId for naming, fallback to timestamp
	baseName := isbn
	if baseName == "" {
		baseName = catalogId
	}
	if baseName == "" {
		baseName = fmt.Sprintf("%d", time.Now().UnixMilli())
	}
	filename := baseName + ".webp"
	dstPath := filepath.Join(uploadDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot save file"})
	}
	defer dst.Close()

	io.Copy(dst, src)
	dst.Close()

	// Resize large covers to reduce bandwidth
	util.ResizeImage(dstPath, util.DefaultResizeConfig)

	imageURL := fmt.Sprintf("/uploads/library/covers/%s", filename)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"url":     imageURL,
	})
}
