package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/middleware"
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
	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := json.Unmarshal(body, &s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	var raw map[string]interface{}
	_ = json.Unmarshal(body, &raw)

	existing, err := h.Repo.GetSettings()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	if existing != nil {
		if _, ok := raw["spmb_is_open"]; !ok {
			s.SPMBIsOpen = existing.SPMBIsOpen
		}
		if _, ok := raw["is_maintenance"]; !ok {
			s.IsMaintenance = existing.IsMaintenance
		}
		if _, ok := raw["last_letter_number"]; !ok {
			s.LastLetterNumber = existing.LastLetterNumber
		}
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

	middleware.CacheInvalidate("/api/public/school-settings")
	middleware.CacheInvalidate("/api/public/homepage")

	return c.JSON(http.StatusOK, updated)
}
