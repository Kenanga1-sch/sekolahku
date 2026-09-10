package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/shared"
)

// ============ Transaksi ============

func (h *SavingsHandler) GetTransactions(c echo.Context) error {
	siswaId := c.QueryParam("siswaId")
	status := c.QueryParam("status")
	if status == "pending" {
		status = "collected"
	}
	guruID := c.QueryParam("guruId")
	search := c.QueryParam("search")
	tipe := c.QueryParam("tipe")
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit, _ = strconv.Atoi(c.QueryParam("perPage"))
	}
	// fetchAll untuk jalur laporan yang butuh seluruh baris dalam periode.
	// Tanpa ini halaman laporan meminta perPage=10000, limit dipotong ke 100
	// di repo, dan totalItems bohong = len(list) — ringkasan laporan pun
	// menjumlah dari data yang terpotong tanpa tanda apa pun.
	fetchAll := c.QueryParam("fetchAll") == "1"
	var startMs, endMs int64
	if startDate := c.QueryParam("startDate"); startDate != "" {
		if parsed, err := time.Parse(time.RFC3339, startDate); err == nil {
			startMs = parsed.UnixMilli()
		}
	}
	if endDate := c.QueryParam("endDate"); endDate != "" {
		if parsed, err := time.Parse(time.RFC3339, endDate); err == nil {
			endMs = parsed.UnixMilli()
		}
	}
	list, total, err := h.Repo.GetTransactions(siswaId, status, guruID, search, tipe, startMs, endMs, limit, fetchAll)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	// totalPages dihitung dari total sejati, bukan konstanta 1. Pemanggil lama
	// (riwayat berpaginasi) memakai ini untuk berhenti menelusuri halaman.
	totalPages := 1
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list, "totalPages": totalPages, "totalItems": total})
}

func (h *SavingsHandler) CreateTransaksi(c echo.Context) error {
	var req models.CreateTransaksiRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if req.Nominal < 1000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Minimal nominal Rp1.000"})
	}
	if req.Nominal > 10000000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Maksimal nominal Rp10.000.000"})
	}
	if err := h.Repo.CreateTransaksi(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mencatat transaksi"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transaksi berhasil dikumpulkan"})
}

func (h *SavingsHandler) KioskDeposit(c echo.Context) error {
	var req struct {
		QRCode  string `json:"qrCode"`
		Nominal int    `json:"nominal"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Input tidak valid"})
	}
	if req.QRCode == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "QR Code diperlukan"})
	}
	if req.Nominal < 1000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Minimal setoran Rp1.000"})
	}
	if req.Nominal > 10000000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Maksimal setoran Rp10.000.000"})
	}

	s, err := h.Repo.GetSiswaByQR(req.QRCode)
	if err != nil || s == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Siswa tidak ditemukan"})
	}

	var kioskUserID string
	_ = h.Repo.DB.QueryRow("SELECT id FROM users WHERE role = 'kiosk' OR username = 'kiosk' LIMIT 1").Scan(&kioskUserID)
	if kioskUserID == "" {
		_ = h.Repo.DB.QueryRow("SELECT id FROM users WHERE role IN ('admin','superadmin') ORDER BY id LIMIT 1").Scan(&kioskUserID)
	}
	if kioskUserID == "" {
		kioskUserID = "system-kiosk"
	}

	txReq := models.CreateTransaksiRequest{
		SiswaID: s.ID,
		UserID:  kioskUserID,
		Tipe:    "setor",
		Nominal: req.Nominal,
		Catatan: shared.StringPtr("Setoran via kiosk"),
	}
	if err := h.Repo.CreateTransaksi(txReq); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mencatat setoran: " + err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":        true,
		"message":        "Setoran berhasil dicatat dan menunggu verifikasi bendahara",
		"balance":        s.SaldoTerakhir,
		"pendingDeposit": req.Nominal,
	})
}

// ============ Setoran (Settlement) ============

func (h *SavingsHandler) CreateSetoran(c echo.Context) error {
	var req models.CreateSetoranRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.CreateSetoran(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Setoran berhasil diajukan"})
}

func (h *SavingsHandler) VerifySetoran(c echo.Context) error {
	var req models.VerifySetoranRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.VerifySetoran(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Setoran telah diproses"})
}

func (h *SavingsHandler) GetSetoranList(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	list, total, err := h.Repo.GetSetoranList(c.QueryParam("status"), c.QueryParam("guruId"), page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "total": total, "page": page, "perPage": perPage})
}

func (h *SavingsHandler) GetSetoranPending(c echo.Context) error {
	guruID := c.QueryParam("guruId")
	list, err := h.Repo.GetSetoranPending(guruID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list})
}

func (h *SavingsHandler) GetSetoranByGuru(c echo.Context) error {
	guruID := c.QueryParam("guruId")
	list, err := h.Repo.GetSetoranByGuru(guruID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list})
}

func (h *SavingsHandler) GetSetoranDetail(c echo.Context) error {
	id := c.QueryParam("id")
	s, err := h.Repo.GetSetoranDetail(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Setoran tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

func (h *SavingsHandler) ResubmitSetoran(c echo.Context) error {
	id := c.QueryParam("id")
	var req struct {
		Catatan string `json:"catatan"`
	}
	c.Bind(&req)
	if err := h.Repo.ResubmitSetoran(id, req.Catatan); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Setoran dikirim ulang"})
}
