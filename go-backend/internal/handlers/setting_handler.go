package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type SettingHandler struct {
	Repo      *repository.SettingRepository
	AuditRepo *repository.AuditLogRepository
}

func NewSettingHandler(repo *repository.SettingRepository, auditRepo *repository.AuditLogRepository) *SettingHandler {
	return &SettingHandler{
		Repo:      repo,
		AuditRepo: auditRepo,
	}
}


func (h *SettingHandler) GetSettings(c echo.Context) error {
	s, err := h.Repo.GetSettings()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

func (h *SettingHandler) UpdateSettings(c echo.Context) error {
	var s models.SchoolSettings
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	updated, err := h.Repo.UpdateSettings(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	// Record Audit Log
	ip := c.RealIP()
	ua := c.Request().UserAgent()
	userID, _ := c.Get("user_id").(string)
	details := "Updated school settings"
	
	h.AuditRepo.CreateLog(models.AuditLog{
		Action:    "update",
		Resource:  "settings",
		UserID:    &userID,
		Details:   &details,
		IPAddress: &ip,
		UserAgent: &ua,
	})

	return c.JSON(http.StatusOK, updated)
}

