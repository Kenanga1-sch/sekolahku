package handlers

import (
	"net/http"
	"strconv"

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
	stats, err := h.Repo.GetSavingsStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

func (h *SavingsHandler) GetSiswa(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 { limit = 20 }
	search := c.QueryParam("search")
	classId := c.QueryParam("classId")

	list, total, err := h.Repo.GetSiswa(page, limit, search, classId)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
		"pagination": map[string]interface{}{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": (total + limit - 1) / limit,
		},
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

func (h *SavingsHandler) GetTransactions(c echo.Context) error {
	siswaId := c.QueryParam("siswaId")
	list, err := h.Repo.GetTransactions(siswaId)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *SavingsHandler) GetSetoranList(c echo.Context) error {
	list, err := h.Repo.GetSetoranList()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

// Admin & Brankas
func (h *SavingsHandler) GetBrankasStatus(c echo.Context) error {
	vaults, err := h.Repo.GetBrankas()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	recent, _ := h.Repo.GetBrankasTransactions()
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true, 
		"data": map[string]interface{}{
			"vaults": vaults,
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
	var req struct{UserID string `json:"userId"`}
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
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *SavingsHandler) AssignClassRep(c echo.Context) error {
	classId := c.Param("id")
	var req struct{UserID string `json:"userId"`}
	c.Bind(&req)
	if err := h.Repo.UpdateClassRep(classId, req.UserID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "PJ Kelas berhasil diupdate"})
}

func (h *SavingsHandler) GetHutangList(c echo.Context) error {
	siswaId := c.QueryParam("siswaId")
	list, err := h.Repo.GetHutang(siswaId)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *SavingsHandler) CreateTransaksi(c echo.Context) error {
	var req models.CreateTransaksiRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.CreateTransaksi(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
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
