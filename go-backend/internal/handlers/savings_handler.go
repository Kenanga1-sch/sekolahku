package handlers

import (
	"net/http"
	"strconv"
	"time"

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

func (h *SavingsHandler) GetStats(c echo.Context) error {
	if dataType := c.QueryParam("type"); dataType != "" {
		var (
			data interface{}
			err  error
		)
		switch dataType {
		case "top-savers":
			data, err = h.Repo.GetTopSavers(5)
		case "recent":
			data, err = h.Repo.GetRecentTransactions(8)
		case "trend":
			data, err = h.Repo.GetTransactionTrend()
		case "saldo-by-kelas":
			data, err = h.Repo.GetSaldoByKelas()
		default:
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tipe data tidak dikenal"})
		}
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": data, "items": data})
	}

	stats, err := h.Repo.GetSavingsStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

func (h *SavingsHandler) GetSiswa(c echo.Context) error {
	if qrCode := c.QueryParam("qrCode"); qrCode != "" {
		s, err := h.Repo.GetSiswaByQR(qrCode)
		if err != nil || s == nil {
			return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": []models.TabunganSiswa{}, "items": []models.TabunganSiswa{}, "totalPages": 1})
		}
		list := []models.TabunganSiswa{*s}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list, "totalPages": 1, "totalItems": 1})
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit, _ = strconv.Atoi(c.QueryParam("perPage"))
	}
	if limit < 1 {
		limit = 20
	}
	search := c.QueryParam("search")
	classId := c.QueryParam("classId")
	if classId == "" {
		classId = c.QueryParam("kelasId")
	}

	list, total, err := h.Repo.GetSiswa(page, limit, search, classId)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	totalPages := (total + limit - 1) / limit
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"data":       list,
		"items":      list,
		"totalItems": total,
		"totalPages": totalPages,
		"pagination": map[string]interface{}{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": totalPages,
		},
	})
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

	txReq := models.CreateTransaksiRequest{
		SiswaID: s.ID,
		Tipe:    "setor",
		Nominal: req.Nominal,
	}
	if err := h.Repo.CreateTransaksi(txReq); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mencatat setoran"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Setoran berhasil dicatat",
		"balance": s.SaldoTerakhir + req.Nominal,
	})
}

func (h *SavingsHandler) GetDetailSiswa(c echo.Context) error {
	id := c.Param("id") // Could be ID or QR Code
	s, err := h.Repo.GetSiswaByQR(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Siswa tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

func (h *SavingsHandler) CreateSiswa(c echo.Context) error {
	var req models.CreateSiswaRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.CreateSiswa(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "message": "Siswa tabungan berhasil dibuat"})
}

func (h *SavingsHandler) UpdateSiswa(c echo.Context) error {
	var req models.CreateSiswaRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.UpdateSiswa(c.Param("id"), req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Siswa tabungan berhasil diperbarui"})
}

func (h *SavingsHandler) DeleteSiswa(c echo.Context) error {
	if err := h.Repo.DeleteSiswa(c.Param("id")); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Siswa tabungan dinonaktifkan"})
}

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
	list, err := h.Repo.GetTransactions(siswaId, status, guruID, search, tipe, startMs, endMs, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list, "totalPages": 1, "totalItems": len(list)})
}

func (h *SavingsHandler) GetSetoranList(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))

	list, total, err := h.Repo.GetSetoranList(c.QueryParam("status"), c.QueryParam("guruId"), page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "total": total, "page": page, "perPage": perPage})
}

// Admin & Brankas
func (h *SavingsHandler) GetBrankasStatus(c echo.Context) error {
	vaults, err := h.Repo.GetBrankas()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	recent, _ := h.Repo.GetBrankasTransactions()
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":            true,
		"vaults":             vaults,
		"items":              vaults,
		"recentTransactions": recent,
		"data": map[string]interface{}{
			"vaults":             vaults,
			"recentTransactions": recent,
		},
	})
}

func (h *SavingsHandler) GetBrankasSummary(c echo.Context) error {
	// Alias or more detailed
	return h.GetBrankasStatus(c)
}

func (h *SavingsHandler) TransferBrankas(c echo.Context) error {
	var req models.TransferBrankasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.TransferBrankas(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transfer berhasil"})
}

func (h *SavingsHandler) GetTreasurer(c echo.Context) error {
	u, err := h.Repo.GetSavingsTreasurer()
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": nil})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": u})
}

func (h *SavingsHandler) AssignTreasurer(c echo.Context) error {
	var req struct {
		UserID string `json:"userId"`
	}
	c.Bind(&req)
	if err := h.Repo.UpdateSavingsTreasurer(req.UserID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Bendahara berhasil ditunjuk"})
}

func (h *SavingsHandler) GetClassesWithReps(c echo.Context) error {
	list, err := h.Repo.GetClassesWithReps()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list})
}

func (h *SavingsHandler) AssignClassRep(c echo.Context) error {
	classId := c.Param("id")
	var req struct {
		UserID string `json:"userId"`
	}
	c.Bind(&req)
	if err := h.Repo.UpdateClassRep(classId, req.UserID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "PJ Kelas berhasil diupdate"})
}

func (h *SavingsHandler) CreateKelas(c echo.Context) error {
	var req struct {
		Nama      string  `json:"nama"`
		WaliKelas *string `json:"waliKelas"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateKelas(req.Nama, req.WaliKelas); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) UpdateKelas(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Nama      string  `json:"nama"`
		WaliKelas *string `json:"waliKelas"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateKelas(id, req.Nama, req.WaliKelas); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) DeleteKelas(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteKelas(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) GetHutangList(c echo.Context) error {
	siswaId := c.QueryParam("siswaId")
	list, err := h.Repo.GetHutang(siswaId)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *SavingsHandler) CreateHutang(c echo.Context) error {
	var hModel models.TabunganHutang
	if err := c.Bind(&hModel); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateHutang(hModel); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) CancelHutang(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteHutang(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) PayHutangCash(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Amount int `json:"amount"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.PayHutangCash(id, req.Amount); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Pembayaran berhasil"})
}

func (h *SavingsHandler) SettleHutangFromTabungan(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.SettleHutangFromSavings(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Pelunasan dari tabungan berhasil"})
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

func (h *SavingsHandler) CreateSetoran(c echo.Context) error {
	var req models.CreateSetoranRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.CreateSetoran(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Setoran berhasil diajukan"})
}

func (h *SavingsHandler) VerifySetoran(c echo.Context) error {
	var req models.VerifySetoranRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.VerifySetoran(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Setoran telah diproses"})
}

// GetSetoranPending returns pending settlements
func (h *SavingsHandler) GetSetoranPending(c echo.Context) error {
	guruID := c.QueryParam("guruId")
	list, err := h.Repo.GetSetoranPending(guruID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list})
}

// GetSetoranByGuru returns settlement history for a specific teacher
func (h *SavingsHandler) GetSetoranByGuru(c echo.Context) error {
	guruID := c.QueryParam("guruId")
	list, err := h.Repo.GetSetoranByGuru(guruID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list})
}

// GetSetoranDetail returns detail for a specific settlement
func (h *SavingsHandler) GetSetoranDetail(c echo.Context) error {
	id := c.QueryParam("id")
	s, err := h.Repo.GetSetoranDetail(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Setoran tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

// ResubmitSetoran resubmits a settled batch
func (h *SavingsHandler) ResubmitSetoran(c echo.Context) error {
	id := c.QueryParam("id")
	var req struct {
		Catatan string `json:"catatan"`
	}
	c.Bind(&req)
	if err := h.Repo.ResubmitSetoran(id, req.Catatan); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Setoran dikirim ulang"})
}

// CreateBrankas creates a new vault
func (h *SavingsHandler) CreateBrankas(c echo.Context) error {
	var req models.CreateBrankasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateBrankas(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

// UpdateBrankas updates an existing vault
func (h *SavingsHandler) UpdateBrankas(c echo.Context) error {
	id := c.Param("id")
	var req models.CreateBrankasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateBrankas(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// CreateHutangBatch creates multiple debts at once
func (h *SavingsHandler) CreateHutangBatch(c echo.Context) error {
	var req struct {
		Entries []models.TabunganHutang `json:"entries"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateHutangBatch(req.Entries); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

// GetFinalReport returns the end-of-year report for a student
func (h *SavingsHandler) GetFinalReport(c echo.Context) error {
	studentID := c.QueryParam("siswaId")
	if studentID == "" {
		studentID = c.QueryParam("studentId")
	}
	year := c.QueryParam("year")
	if year == "" {
		year = strconv.Itoa(time.Now().Year())
	}
	report, err := h.Repo.GetFinalReport(studentID, year)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": report})
}

// GetStatement returns bank statement (rekening koran)
func (h *SavingsHandler) GetStatement(c echo.Context) error {
	siswaID := c.QueryParam("siswaId")
	if siswaID == "" {
		siswaID = c.QueryParam("studentId")
	}
	list, err := h.Repo.GetStatement(siswaID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

// VerifyStatement verifies a statement hash
func (h *SavingsHandler) VerifyStatement(c echo.Context) error {
	hash := c.QueryParam("hash")
	if err := h.Repo.VerifyStatement(hash); err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Invalid hash"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) CheckPublicBalance(c echo.Context) error {
	var req struct {
		Identifier string `json:"identifier"`
		BirthDate  string `json:"birthDate"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	s, err := h.Repo.GetPublicBalance(req.Identifier, req.BirthDate)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Data siswa tidak ditemukan atau data tidak cocok"})
	}

	className := "-"
	if s.Kelas != nil {
		className = s.Kelas.Nama
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"name":       s.Nama,
			"className":  className,
			"balance":    s.SaldoTerakhir,
			"lastUpdate": s.UpdatedAt,
		},
	})
}
