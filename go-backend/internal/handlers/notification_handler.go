package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type NotificationHandler struct {
	Repo *repository.NotificationRepository
}

func NewNotificationHandler(repo *repository.NotificationRepository) *NotificationHandler {
	return &NotificationHandler{Repo: repo}
}

func (h *NotificationHandler) GetNotifications(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	limitStr := c.QueryParam("limit")
	pageStr := c.QueryParam("page")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	offset := (page - 1) * limit

	notifications, err := h.Repo.GetNotifications(userID, limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	total, _ := h.Repo.CountNotifications(userID)
	totalPages := (total + limit - 1) / limit

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data":       notifications,
		"total":      total,
		"page":       page,
		"totalPages": totalPages,
	})
}

func (h *NotificationHandler) GetStats(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	stats, err := h.Repo.GetStats(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *NotificationHandler) MarkAsRead(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.MarkAsRead(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *NotificationHandler) MarkAllAsRead(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if err := h.Repo.MarkAllAsRead(userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// BroadcastNotification mengirim pengumuman sistem ke seluruh pengguna
// dashboard. Hanya superadmin/admin yang boleh memakai rute ini.
func (h *NotificationHandler) BroadcastNotification(c echo.Context) error {
	var n models.Notification
	if err := c.Bind(&n); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if strings.TrimSpace(n.Title) == "" || strings.TrimSpace(n.Message) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Judul dan pesan wajib diisi"})
	}
	if n.Type == "" {
		n.Type = "info"
	}
	if n.Category == "" {
		n.Category = "system"
	}
	if err := h.Repo.BroadcastNotification(n); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}
