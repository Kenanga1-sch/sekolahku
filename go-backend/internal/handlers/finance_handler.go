package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type FinanceHandler struct {
	Repo *repository.FinanceRepository
}

func NewFinanceHandler(repo *repository.FinanceRepository) *FinanceHandler {
	return &FinanceHandler{Repo: repo}
}

func parseFinanceDate(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	if ms, err := strconv.ParseInt(value, 10, 64); err == nil {
		t := time.UnixMilli(ms)
		return &t, nil
	}
	layouts := []string{time.RFC3339, "2006-01-02", time.RFC1123Z, time.RFC1123}
	var lastErr error
	for _, layout := range layouts {
		t, err := time.Parse(layout, value)
		if err == nil {
			return &t, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func financeUserID(c echo.Context) *string {
	for _, key := range []string{"user_id", "userId"} {
		if value, ok := c.Get(key).(string); ok && strings.TrimSpace(value) != "" {
			return &value
		}
	}
	return nil
}

// Stats
func (h *FinanceHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetFinanceStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

func (h *FinanceHandler) GetDashboard(c echo.Context) error {
	stats, err := h.Repo.GetFinanceStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	accounts, _ := h.Repo.GetAccounts()
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"stats":    stats,
			"accounts": accounts,
		},
	})
}

// Accounts
func (h *FinanceHandler) GetAccounts(c echo.Context) error {
	accounts, err := h.Repo.GetAccounts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": accounts})
}

func (h *FinanceHandler) CreateAccount(c echo.Context) error {
	var req models.CreateFinanceAccountRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateAccount(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "message": "Akun berhasil dibuat"})
}

func (h *FinanceHandler) UpdateAccount(c echo.Context) error {
	id := c.Param("id")
	var req models.CreateFinanceAccountRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateAccount(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Akun berhasil diperbarui"})
}

func (h *FinanceHandler) DeleteAccount(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAccount(id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Akun berhasil dihapus"})
}

// Categories
func (h *FinanceHandler) GetCategories(c echo.Context) error {
	list, err := h.Repo.GetCategories()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *FinanceHandler) CreateCategory(c echo.Context) error {
	var req models.CreateFinanceCategoryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateCategory(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "message": "Kategori berhasil dibuat"})
}

func (h *FinanceHandler) UpdateCategory(c echo.Context) error {
	id := c.Param("id")
	var req models.FinanceCategory
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateCategory(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Kategori berhasil diperbarui"})
}

func (h *FinanceHandler) DeleteCategory(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteCategory(id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Kategori berhasil dihapus"})
}

// Transactions
func (h *FinanceHandler) GetTransactions(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	startDate, err := parseFinanceDate(c.QueryParam("startDate"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format tanggal awal tidak valid"})
	}
	endDate, err := parseFinanceDate(c.QueryParam("endDate"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format tanggal akhir tidak valid"})
	}

	list, err := h.Repo.GetTransactions(models.FinanceTransactionFilters{
		AccountID: c.QueryParam("accountId"),
		StartDate: startDate,
		EndDate:   endDate,
		Type:      c.QueryParam("type"),
		Status:    c.QueryParam("status"),
		Sort:      c.QueryParam("sort"),
		Limit:     limit,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *FinanceHandler) CreateTransaction(c echo.Context) error {
	var req models.CreateFinanceTransactionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	req.CreatedBy = financeUserID(c)
	if err := h.Repo.CreateTransaction(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "message": "Transaksi berhasil dicatat"})
}

func (h *FinanceHandler) UpdateTransaction(c echo.Context) error {
	id := c.Param("id")
	var req models.FinanceTransaction
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateTransaction(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transaksi berhasil diperbarui"})
}

func (h *FinanceHandler) DeleteTransaction(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteTransaction(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transaksi berhasil dihapus"})
}
