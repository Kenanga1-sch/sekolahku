package handlers

import (
	"net"
	"net/http"
	"net/url"
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	filtered := SanitizeIntegrationSettings(&s)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": filtered})
}

type IntegrationSettingsPublic struct {
	ID           string `json:"id"`
	DapodikURL   string `json:"dapodikUrl"`
	DapodikToken string `json:"dapodikToken,omitempty"`
	DapodikNPSN  string `json:"dapodikNpsn"`
	ERaporURL    string `json:"eraporUrl"`
	ERaporToken  string `json:"eraporToken,omitempty"`
	ERaporDBHost string `json:"eraporDbHost"`
	ERaporDBPort string `json:"eraporDbPort"`
	ERaporDBUser string `json:"eraporDbUser"`
	ERaporDBPass string `json:"eraporDbPass,omitempty"`
	ERaporDBName string `json:"eraporDbName"`
	IsSandbox    bool   `json:"isSandbox"`
	LastSyncedAt int64  `json:"lastSyncedAt"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

func SanitizeIntegrationSettings(s *models.IntegrationSettings) IntegrationSettingsPublic {
	if s == nil {
		return IntegrationSettingsPublic{}
	}
	return IntegrationSettingsPublic{
		ID:           s.ID,
		DapodikURL:   s.DapodikURL,
		DapodikToken: maskSecret(s.DapodikToken),
		DapodikNPSN:  s.DapodikNPSN,
		ERaporURL:    s.ERaporURL,
		ERaporToken:  maskSecret(s.ERaporToken),
		ERaporDBHost: s.ERaporDBHost,
		ERaporDBPort: s.ERaporDBPort,
		ERaporDBUser: s.ERaporDBUser,
		ERaporDBPass: maskSecret(s.ERaporDBPass),
		ERaporDBName: s.ERaporDBName,
		IsSandbox:    s.IsSandbox,
		LastSyncedAt: s.LastSyncedAt,
		CreatedAt:    s.CreatedAt,
		UpdatedAt:    s.UpdatedAt,
	}
}

func maskSecret(s string) string {
	if s == "" {
		return ""
	}
	return "********"
}

func (h *IntegrationHandler) UpdateSettings(c echo.Context) error {
	var s models.IntegrationSettings
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	err := h.Repo.UpdateSettings(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
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

	parsedURL, err := url.Parse(dapodikURL)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format URL Dapodik tidak valid",
		})
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "URL Dapodik harus menggunakan http atau https",
		})
	}

	host := parsedURL.Hostname()
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   "Tidak dapat terhubung ke alamat internal",
			})
		}
	}

	ips, err := net.LookupIP(host)
	if err == nil {
		for _, ip := range ips {
			if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
				return c.JSON(http.StatusBadRequest, map[string]interface{}{
					"success": false,
					"error":   "Tidak dapat terhubung ke alamat internal",
				})
			}
		}
	}

	client := http.Client{
		Timeout: 3 * time.Second,
	}

	req, err := http.NewRequest("GET", dapodikURL, nil)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   "Format URL Dapodik tidak valid",
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	inserted, updated, logs, err := h.Repo.RunSync(s)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":  false,
			"error":    "Sinkronisasi gagal. Silakan coba lagi.",
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
