package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
)

// ============ Hutang (Debt Management) ============

func (h *SavingsHandler) GetHutangList(c echo.Context) error {
	siswaId := c.QueryParam("siswaId")
	list, err := h.Repo.GetHutang(siswaId)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *SavingsHandler) CreateHutang(c echo.Context) error {
	var hModel models.TabunganHutang
	if err := c.Bind(&hModel); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateHutang(hModel); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) UpdateHutang(c echo.Context) error {
	id := c.Param("id")
	var input models.UpdateHutangRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateHutang(id, input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) CancelHutang(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteHutang(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) PayHutangCash(c echo.Context) error {
	id := c.Param("id")
	var req models.PayHutangRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	operatorIDVal := c.Get("user_id")
	operatorID, ok := operatorIDVal.(string)
	if !ok || operatorID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "error": "Unauthorized: operator ID tidak valid"})
	}
	if err := h.Repo.PayHutangCash(id, req.Amount, operatorID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Pembayaran berhasil"})
}

func (h *SavingsHandler) SettleHutangFromTabungan(c echo.Context) error {
	id := c.Param("id")
	var req models.PayHutangRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	operatorIDVal := c.Get("user_id")
	operatorID, ok := operatorIDVal.(string)
	if !ok || operatorID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "error": "Unauthorized: operator ID tidak valid"})
	}
	if err := h.Repo.SettleHutangFromSavings(id, req.Amount, operatorID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Pelunasan dari tabungan berhasil"})
}

func (h *SavingsHandler) GetHutangPayments(c echo.Context) error {
	id := c.Param("id")
	payments, err := h.Repo.GetHutangPayments(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, payments)
}

func (h *SavingsHandler) CreateHutangBatch(c echo.Context) error {
	var req struct {
		Entries []models.TabunganHutang `json:"entries"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateHutangBatch(req.Entries); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}
