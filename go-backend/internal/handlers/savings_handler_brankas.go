package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
)

// ============ Brankas (Vault) ============

func (h *SavingsHandler) GetBrankasStatus(c echo.Context) error {
	vaults, err := h.Repo.GetBrankas()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
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
	return h.GetBrankasStatus(c)
}

func (h *SavingsHandler) TransferBrankas(c echo.Context) error {
	var req models.TransferBrankasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.TransferBrankas(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transfer berhasil"})
}

func (h *SavingsHandler) CreateBrankas(c echo.Context) error {
	var req models.CreateBrankasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateBrankas(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) UpdateBrankas(c echo.Context) error {
	id := c.Param("id")
	var req models.CreateBrankasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateBrankas(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Stats ============

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
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": data, "items": data})
	}
	stats, err := h.Repo.GetSavingsStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

// ============ Reports ============

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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": report})
}

func (h *SavingsHandler) GetStatement(c echo.Context) error {
	siswaID := c.QueryParam("siswaId")
	if siswaID == "" {
		siswaID = c.QueryParam("studentId")
	}
	list, err := h.Repo.GetStatement(siswaID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *SavingsHandler) VerifyStatement(c echo.Context) error {
	hash := c.QueryParam("hash")
	if err := h.Repo.VerifyStatement(hash); err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Invalid hash"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Treasurer ============

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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Bendahara berhasil ditunjuk"})
}
