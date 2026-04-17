package handlers

import (
	"net/http"
	"strconv"

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
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Berita tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, a)
}

func (h *AnnouncementHandler) GetAnnouncementByID(c echo.Context) error {
	id := c.Param("id")
	a, err := h.Repo.GetAnnouncementBySlug(id) // Reuse GetAnnouncementBySlug as it handles both
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Announcement not found"})
	}
	return c.JSON(http.StatusOK, a)
}

func (h *AnnouncementHandler) CreateAnnouncement(c echo.Context) error {
	var req models.CreateAnnouncementRequest
	if err := c.Bind(&req); err != nil {
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
	var req models.CreateAnnouncementRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if err := h.Repo.UpdateAnnouncement(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal memperbarui pengumuman"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AnnouncementHandler) DeleteAnnouncement(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAnnouncement(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus pengumuman"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
