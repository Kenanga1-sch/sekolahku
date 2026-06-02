package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AnnouncementHandler struct {
	Repo *repository.AnnouncementRepository
}

func NewAnnouncementHandler(repo *repository.AnnouncementRepository) *AnnouncementHandler {
	return &AnnouncementHandler{Repo: repo}
}

func (h *AnnouncementHandler) GetAnnouncements(c echo.Context) error {
	pageStr := c.QueryParam("page")
	limitStr := c.QueryParam("limit")
	search := c.QueryParam("q")
	includeUnpublished := c.QueryParam("all") == "true"

	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}

	limit := 10
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	res, err := h.Repo.GetAnnouncements(page, limit, search, includeUnpublished)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, res)
}

func (h *AnnouncementHandler) GetPublicAnnouncements(c echo.Context) error {
	// Simple public endpoint
	res, err := h.Repo.GetAnnouncements(1, 100, "", false)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, res.Data)
}

func (h *AnnouncementHandler) GetPublicAnnouncementBySlug(c echo.Context) error {
	slug := c.Param("slug")
	a, err := h.Repo.GetAnnouncementBySlug(slug)
	if err != nil || a == nil || !a.IsPublished {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Berita tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, a)
}

func (h *AnnouncementHandler) GetAnnouncementByID(c echo.Context) error {
	id := c.Param("id")
	a, err := h.Repo.GetAnnouncementBySlug(id) // Reuse GetAnnouncementBySlug as it handles both
	if err != nil || a == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Announcement not found"})
	}
	return c.JSON(http.StatusOK, a)
}

func (h *AnnouncementHandler) CreateAnnouncement(c echo.Context) error {
	req, err := parseAnnouncementRequest(c, nil)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Judul wajib diisi"})
	}

	id, err := h.Repo.CreateAnnouncement(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan pengumuman"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"id":      id,
	})
}

func (h *AnnouncementHandler) UpdateAnnouncement(c echo.Context) error {
	id := c.Param("id")

	existing, err := h.Repo.GetAnnouncementBySlug(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal mengambil pengumuman"})
	}
	if existing == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Pengumuman tidak ditemukan"})
	}

	req, err := parseAnnouncementRequest(c, existing)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}
	if req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Judul wajib diisi"})
	}

	if err := h.Repo.UpdateAnnouncement(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal memperbarui pengumuman"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AnnouncementHandler) DeleteAnnouncement(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAnnouncement(id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Pengumuman tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus pengumuman"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func parseAnnouncementRequest(c echo.Context, existing *models.Announcement) (models.CreateAnnouncementRequest, error) {
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(c.Request().Body).Decode(&raw); err != nil {
		return models.CreateAnnouncementRequest{}, err
	}

	req := models.CreateAnnouncementRequest{}
	if existing != nil {
		req.Title = existing.Title
		req.Slug = existing.Slug
		req.Content = existing.Content
		req.Excerpt = existing.Excerpt
		req.Category = existing.Category
		req.Thumbnail = existing.Thumbnail
		req.IsPublished = existing.IsPublished
		req.IsFeatured = existing.IsFeatured
	}

	if value, ok, err := readJSONString(raw, "title"); err != nil {
		return req, err
	} else if ok {
		req.Title = strings.TrimSpace(value)
	}

	if value, ok, err := readJSONString(raw, "slug"); err != nil {
		return req, err
	} else if ok {
		req.Slug = slugifyAnnouncementTitle(value)
	}

	if value, ok, err := readJSONString(raw, "content"); err != nil {
		return req, err
	} else if ok {
		req.Content = nullableString(value, false)
	}

	if value, ok, err := readJSONString(raw, "excerpt"); err != nil {
		return req, err
	} else if ok {
		req.Excerpt = nullableString(value, true)
	}

	if value, ok, err := readJSONString(raw, "category"); err != nil {
		return req, err
	} else if ok {
		req.Category = nullableString(value, true)
	}

	if value, ok, err := readJSONString(raw, "thumbnail"); err != nil {
		return req, err
	} else if ok {
		req.Thumbnail = nullableString(value, true)
	}

	if value, ok, err := readJSONBool(raw, "isPublished", "is_published"); err != nil {
		return req, err
	} else if ok {
		req.IsPublished = value
	}

	if value, ok, err := readJSONBool(raw, "isFeatured", "is_featured"); err != nil {
		return req, err
	} else if ok {
		req.IsFeatured = value
	}

	if req.Slug == "" && req.Title != "" {
		req.Slug = slugifyAnnouncementTitle(req.Title)
	}
	if req.Category == nil || strings.TrimSpace(*req.Category) == "" {
		category := "pengumuman"
		req.Category = &category
	}

	return req, nil
}

func readJSONString(raw map[string]json.RawMessage, keys ...string) (string, bool, error) {
	for _, key := range keys {
		data, ok := raw[key]
		if !ok {
			continue
		}
		var value *string
		if err := json.Unmarshal(data, &value); err != nil {
			return "", false, err
		}
		if value == nil {
			return "", true, nil
		}
		return *value, true, nil
	}
	return "", false, nil
}

func readJSONBool(raw map[string]json.RawMessage, keys ...string) (bool, bool, error) {
	for _, key := range keys {
		data, ok := raw[key]
		if !ok {
			continue
		}
		var value bool
		if err := json.Unmarshal(data, &value); err != nil {
			return false, false, err
		}
		return value, true, nil
	}
	return false, false, nil
}

func nullableString(value string, trim bool) *string {
	if trim {
		value = strings.TrimSpace(value)
	}
	if value == "" {
		return nil
	}
	return &value
}

func slugifyAnnouncementTitle(title string) string {
	title = strings.ToLower(strings.TrimSpace(title))
	var builder strings.Builder
	lastDash := false

	for _, r := range title {
		isLetter := r >= 'a' && r <= 'z'
		isNumber := r >= '0' && r <= '9'
		if isLetter || isNumber {
			builder.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteByte('-')
			lastDash = true
		}
	}

	return strings.Trim(builder.String(), "-")
}
