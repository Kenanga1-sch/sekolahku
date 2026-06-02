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
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type GalleryHandler struct {
	Repo *repository.GalleryRepository
}

func NewGalleryHandler(repo *repository.GalleryRepository) *GalleryHandler {
	return &GalleryHandler{Repo: repo}
}

func (h *GalleryHandler) GetGallery(c echo.Context) error {
	cat := c.QueryParam("category")
	list, err := h.Repo.GetGallery(cat)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": list})
}

func (h *GalleryHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *GalleryHandler) Upload(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No file uploaded"})
	}

	title := strings.TrimSpace(c.FormValue("title"))
	if title == "" {
		title = strings.TrimSuffix(file.Filename, filepath.Ext(file.Filename))
	}
	category := normalizeGalleryCategory(c.FormValue("category"))

	// Max size 5MB
	if file.Size > 5*1024*1024 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File too large (max 5MB)"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot open file"})
	}
	defer src.Close()

	// Detect content type
	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	contentType := http.DetectContentType(buf[:n])
	src.Seek(0, io.SeekStart)
	if !strings.HasPrefix(contentType, "image/") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File harus berupa gambar"})
	}

	ext := "jpg"
	if strings.HasSuffix(contentType, "png") {
		ext = "png"
	}
	if strings.HasSuffix(contentType, "webp") {
		ext = "webp"
	}
	if strings.HasSuffix(contentType, "gif") {
		ext = "gif"
	}

	// Create directory
	uploadDir := filepath.Join("public", "uploads", "gallery")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot create directory"})
	}

	// Generate filename
	b := make([]byte, 12)
	rand.Read(b)
	filename := fmt.Sprintf("%d-%s.%s", time.Now().UnixMilli(), hex.EncodeToString(b), ext)
	dstPath := filepath.Join(uploadDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot save file"})
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Cannot write file"})
	}

	imageURL := fmt.Sprintf("/uploads/gallery/%s", filename)

	// Save to DB
	item := models.GalleryItem{
		Title:    title,
		Category: category,
		ImageUrl: imageURL,
	}

	id, err := h.Repo.Create(item)
	if err != nil {
		// Attempt to delete the file if DB fails
		os.Remove(dstPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"id":      id,
		"url":     imageURL,
	})
}

func (h *GalleryHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Title    string `json:"title"`
		Category string `json:"category"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	current, err := h.Repo.GetByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Foto tidak ditemukan"})
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = current.Title
	}
	category := current.Category
	if strings.TrimSpace(req.Category) != "" {
		category = normalizeGalleryCategory(req.Category)
	}

	if err := h.Repo.Update(id, title, category); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *GalleryHandler) Delete(c echo.Context) error {
	id := c.Param("id")

	// Get image path first to delete file
	item, err := h.Repo.GetByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Foto tidak ditemukan"})
	}

	// Delete from DB
	if err := h.Repo.Delete(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Delete physical file (best effort)
	if item.ImageUrl != "" {
		relPath := strings.TrimPrefix(item.ImageUrl, "/")
		os.Remove(filepath.Join("public", relPath))
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func normalizeGalleryCategory(category string) string {
	switch strings.ToLower(strings.TrimSpace(category)) {
	case "kegiatan", "fasilitas", "prestasi", "lainnya":
		return strings.ToLower(strings.TrimSpace(category))
	default:
		return "lainnya"
	}
}

func (h *GalleryHandler) BulkDelete(c echo.Context) error {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	// Get paths for cleanup
	paths, _ := h.Repo.GetImagePathsByIDs(req.IDs)

	if err := h.Repo.BulkDelete(req.IDs); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Cleanup files
	for _, path := range paths {
		relPath := strings.TrimPrefix(path, "/")
		os.Remove(filepath.Join("public", relPath))
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
