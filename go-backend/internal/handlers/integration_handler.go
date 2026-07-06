package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type IntegrationHandler struct {
	Repo *repository.IntegrationRepository
}

func NewIntegrationHandler(repo *repository.IntegrationRepository) *IntegrationHandler {
	return &IntegrationHandler{Repo: repo}
}

func (h *IntegrationHandler) GetSettings(c echo.Context) error {
	s, err := h.Repo.GetSettings()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

func (h *IntegrationHandler) UpdateSettings(c echo.Context) error {
	var s models.IntegrationSettings
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	err := h.Repo.UpdateSettings(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Pengaturan integrasi berhasil disimpan"})
}

func (h *IntegrationHandler) TestConnection(c echo.Context) error {
	var s models.IntegrationSettings
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	if s.IsSandbox {
		time.Sleep(800 * time.Millisecond) // Mock loading
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": true,
			"dapodik": "OK (Simulasi)",
			"erapor":  "OK (Simulasi)",
		})
	}

	// Real connection test
	dapodikURL := strings.TrimSpace(s.DapodikURL)
	if dapodikURL == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "URL Dapodik tidak boleh kosong untuk uji koneksi real",
		})
	}

	client := http.Client{
		Timeout: 3 * time.Second,
	}
	
	req, err := http.NewRequest("GET", dapodikURL, nil)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   "Format URL Dapodik tidak valid: " + err.Error(),
		})
	}

	if s.DapodikToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.DapodikToken)
	}

	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   "Gagal terhubung ke Dapodik di " + dapodikURL + " (Connection Refused). Pastikan server berjalan dan port Web Service diaktifkan.",
		})
	}
	defer resp.Body.Close()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"dapodik": "Terhubung (HTTP " + resp.Status + ")",
		"erapor":  "Menunggu sinkronisasi",
	})
}

func (h *IntegrationHandler) SyncNow(c echo.Context) error {
	s, err := h.Repo.GetSettings()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	inserted, updated, logs, err := h.Repo.RunSync(s)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":  false,
			"error":    err.Error(),
			"logs":     logs,
			"inserted": inserted,
			"updated":  updated,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"inserted": inserted,
		"updated":  updated,
		"logs":     logs,
	})
}
