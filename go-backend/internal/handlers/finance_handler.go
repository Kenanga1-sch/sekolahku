package handlers

import (
	"net/http"

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
			"stats": stats,
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

func (h *FinanceHandler) DeleteCategory(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteCategory(id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Kategori berhasil dihapus"})
}

// Transactions
func (h *FinanceHandler) GetTransactions(c echo.Context) error {
	list, err := h.Repo.GetTransactions()
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
	if err := h.Repo.CreateTransaction(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "message": "Transaksi berhasil dicatat"})
}

func (h *FinanceHandler) DeleteTransaction(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteTransaction(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transaksi berhasil dihapus"})
}
