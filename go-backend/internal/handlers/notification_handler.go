package handlers

import (
	"net/http"
	"strconv"

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
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}

	notifications, err := h.Repo.GetNotifications(userID, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	// The frontend expect an array directly in some places, or a wrapper.
	// Based on admin/notifikasi/page.tsx: data = await res.json(); setNotifications(data);
	return c.JSON(http.StatusOK, notifications)
}

func (h *NotificationHandler) GetStats(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	stats, err := h.Repo.GetStats(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *NotificationHandler) MarkAsRead(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.MarkAsRead(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *NotificationHandler) MarkAllAsRead(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if err := h.Repo.MarkAllAsRead(userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *NotificationHandler) CreateNotification(c echo.Context) error {
	var n models.Notification
	if err := c.Bind(&n); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.CreateNotification(n); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *NotificationHandler) BroadcastNotification(c echo.Context) error {
	var n models.Notification
	if err := c.Bind(&n); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.BroadcastNotification(n); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}
