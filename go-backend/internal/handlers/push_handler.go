package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/push"
)

type PushHandler struct {
	Push *push.Service
}

func NewPushHandler(pushSvc *push.Service) *PushHandler {
	return &PushHandler{Push: pushSvc}
}

// GetVAPIDKey mengembalikan public key untuk pushManager.subscribe.
// Publik karena frontend membutuhkannya sebelum login pun tidak masalah —
// public key memang aman dibagikan.
func (h *PushHandler) GetVAPIDKey(c echo.Context) error {
	key := h.Push.PublicKey()
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":   true,
		"enabled":   h.Push.Enabled(),
		"publicKey": key,
	})
}

// Subscribe menyimpan subscription perangkat milik user yang login.
func (h *PushHandler) Subscribe(c echo.Context) error {
	if !h.Push.Enabled() {
		return c.JSON(http.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "Notifikasi push belum diaktifkan server"})
	}
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "error": "Tidak terautentikasi"})
	}
	var req models.PushSubscribeRequest
	if err := c.Bind(&req); err != nil || req.Endpoint == "" || req.P256dh == "" || req.Auth == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data subscription tidak lengkap"})
	}
	if req.UserAgent == "" {
		req.UserAgent = c.Request().UserAgent()
	}
	if err := h.Push.Repo.Upsert(userID, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan subscription"})
	}
	n, _ := h.Push.Repo.CountByUser(userID)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "devices": n})
}

// Unsubscribe menghapus subscription perangkat (hanya milik sendiri).
func (h *PushHandler) Unsubscribe(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "error": "Tidak terautentikasi"})
	}
	var req models.PushUnsubscribeRequest
	if err := c.Bind(&req); err != nil || req.Endpoint == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Endpoint wajib diisi"})
	}
	if err := h.Push.Repo.DeleteByEndpoint(userID, req.Endpoint); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menghapus subscription"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// Status memberi jumlah perangkat terdaftar untuk UI.
func (h *PushHandler) Status(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "error": "Tidak terautentikasi"})
	}
	n, _ := h.Push.Repo.CountByUser(userID)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "enabled": h.Push.Enabled(), "devices": n})
}

// TestSend mengirim notifikasi uji ke perangkat pemanggil sendiri. Dipakai
// halaman profil (admin maupun orang tua) untuk memverifikasi push aktif.
func (h *PushHandler) TestSend(c echo.Context) error {
	if !h.Push.Enabled() {
		return c.JSON(http.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "Notifikasi push belum diaktifkan server"})
	}
	userID, _ := c.Get("user_id").(string)
	sent := h.Push.SendToUser(userID, models.PushPayload{
		Title: "Notifikasi aktif",
		Body:  "Uji coba berhasil — notifikasi sekolah akan muncul seperti ini.",
		URL:   "/",
		Tag:   "test-push",
	})
	if sent == 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{"success": false, "error": "Tidak ada perangkat terdaftar atau pengiriman gagal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "sent": sent})
}
