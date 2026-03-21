package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type SavingsHandler struct {
	Repo *repository.SavingsRepository
}

func NewSavingsHandler(repo *repository.SavingsRepository) *SavingsHandler {
	return &SavingsHandler{Repo: repo}
}

func (h *SavingsHandler) CreateTransaksi(c echo.Context) error {
	var req models.CreateTransaksiRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if req.SiswaID == "" || req.Tipe == "" || req.Nominal <= 0 || req.UserID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Lengkapi semua data transaksi dengan benar"})
	}

	if err := h.Repo.CreateTransaksi(req); err != nil {
		c.Logger().Error("Failed to create transaksi:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Transaksi berhasil dikumpulkan",
	})
}

func (h *SavingsHandler) CreateSetoran(c echo.Context) error {
	var req models.CreateSetoranRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if req.GuruID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "GuruID wajib diisi"})
	}

	if err := h.Repo.CreateSetoran(req); err != nil {
		c.Logger().Error("Failed to create setoran:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Setoran Harian berhasil diajukan ke Bendahara",
	})
}

func (h *SavingsHandler) VerifySetoran(c echo.Context) error {
	var req models.VerifySetoranRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if req.SetoranID == "" || req.Status == "" || req.BendaharaID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data verifikasi tidak lengkap"})
	}

	if err := h.Repo.VerifySetoran(req); err != nil {
		c.Logger().Error("Failed to verify setoran:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	msg := "Setoran berhasil diverifikasi dan masuk ke Brankas Kas"
	if req.Status == "rejected" {
		msg = "Setoran secara resmi ditolak"
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": msg,
	})
}
