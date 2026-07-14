package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/repository"
	"github.com/sekolahku/go-backend/internal/util"
)

type GalleryHandler struct {
	Repo *repository.GalleryRepository
}

func NewGalleryHandler(repo *repository.GalleryRepository) *GalleryHandler {
	return &GalleryHandler{Repo: repo}
}

func (h *GalleryHandler) GetGallery(c echo.Context) error {
	cat := c.QueryParam("category")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))

	list, total, err := h.Repo.GetGallery(cat, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": list, "total": total, "page": page, "perPage": perPage})
}

func (h *GalleryHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *GalleryHandler) Upload(c echo.Context) error {
	url := strings.TrimSpace(c.FormValue("url"))
	title := strings.TrimSpace(c.FormValue("title"))
	category := normalizeGalleryCategory(c.FormValue("category"))

	var imageURL string

	if url != "" {
		// External URL mode (YouTube, Instagram)
		if title == "" {
			title = "External Media"
		}
		imageURL = url
	} else {
		// File upload mode
		file, err := c.FormFile("file")
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "No file or url provided"})
		}

		if title == "" {
			title = strings.TrimSuffix(file.Filename, filepath.Ext(file.Filename))
		}

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
		dst.Close()

		// Generate thumbnail
		thumbDir := filepath.Join("public", "uploads", "gallery", "thumbs")
		util.GenerateThumbnail(dstPath, thumbDir, util.DefaultThumbnailConfig)

		imageURL = fmt.Sprintf("/uploads/gallery/%s", filename)
	}

	// Save to DB
	item := models.GalleryItem{
		Title:    title,
		Category: category,
		ImageUrl: imageURL,
	}

	id, err := h.Repo.Create(item)
	if err != nil {
		if url == "" {
			// Attempt to delete the file if DB fails
			os.Remove(filepath.Join("public", imageURL))
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	middleware.CacheInvalidate("/api/public/gallery")
	middleware.CacheInvalidate("/api/public/homepage")

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

	middleware.CacheInvalidate("/api/public/gallery")
	middleware.CacheInvalidate("/api/public/homepage")

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

	middleware.CacheInvalidate("/api/public/gallery")
	middleware.CacheInvalidate("/api/public/homepage")

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

	middleware.CacheInvalidate("/api/public/gallery")
	middleware.CacheInvalidate("/api/public/homepage")

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
