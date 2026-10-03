package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// ThemePresetHandler — CRUD preset tema warna (admin only).
// Endpoint /api/theme-presets dipakai tab Landing → kartu Tema Warna.
type ThemePresetHandler struct {
	Repo      *repository.ThemePresetRepository
	SettingRepo *repository.SettingRepository
	AuditRepo *repository.AuditLogRepository
}

func NewThemePresetHandler(repo *repository.ThemePresetRepository, settingRepo *repository.SettingRepository, auditRepo *repository.AuditLogRepository) *ThemePresetHandler {
	return &ThemePresetHandler{Repo: repo, SettingRepo: settingRepo, AuditRepo: auditRepo}
}

func (h *ThemePresetHandler) logUpdate(c echo.Context, details string) {
	ip := c.RealIP()
	ua := c.Request().UserAgent()
	userID, _ := c.Get("user_id").(string)
	_ = h.AuditRepo.CreateLog(models.AuditLog{
		Action:   "update",
		Resource: "theme_presets",
		UserID:   &userID,
		Details:  &details,
		IPAddress: &ip,
		UserAgent: &ua,
	})
}

func (h *ThemePresetHandler) GetAll(c echo.Context) error {
	list, err := h.Repo.GetAll()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat preset tema"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *ThemePresetHandler) Create(c echo.Context) error {
	var req models.SavedThemeRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Payload tidak valid"})
	}
	created, err := h.Repo.Create(req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	h.logUpdate(c, "Buat preset tema: "+created.Name)
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "data": created})
}

func (h *ThemePresetHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var req models.SavedThemeRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Payload tidak valid"})
	}
	updated, err := h.Repo.Update(id, req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	h.logUpdate(c, "Ubah preset tema: "+updated.Name)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": updated})
}

func (h *ThemePresetHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.Delete(id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	h.logUpdate(c, "Hapus preset tema: "+id)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// Apply — salin brand_theme preset ke school_settings.brand_theme (instan via ThemeInjector).
func (h *ThemePresetHandler) Apply(c echo.Context) error {
	id := c.Param("id")
	preset, err := h.Repo.GetByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Preset tidak ditemukan"})
	}
	if strings.TrimSpace(preset.BrandTheme) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Preset kosong"})
	}

	existing, err := h.SettingRepo.GetSettings()
	if err != nil || existing == nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membaca pengaturan"})
	}
	patch := models.SchoolSettings{
		ID:         existing.ID,
		BrandTheme: &preset.BrandTheme,
	}
	updated, err := h.SettingRepo.UpdateSettings(models.SchoolSettings{
		ID:            existing.ID,
		SchoolName:    existing.SchoolName,
		CurrentAcademicYear: existing.CurrentAcademicYear,
		LetterNumberFormat:  existing.LetterNumberFormat,
		SPMBIsOpen:    existing.SPMBIsOpen,
		LastLetterNumber: existing.LastLetterNumber,
		BrandTheme:    patch.BrandTheme,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menerapkan preset"})
	}
	h.logUpdate(c, "Terapkan preset tema: "+preset.Name)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": updated})
}
