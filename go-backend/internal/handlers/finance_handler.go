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

func (h *FinanceHandler) GetAccounts(c echo.Context) error {
	accounts, err := h.Repo.GetAccounts()
	if err != nil {
		c.Logger().Error("Failed to get accounts:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengambil data akun",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    accounts,
	})
}

func (h *FinanceHandler) CreateAccount(c echo.Context) error {
	var req models.CreateFinanceAccountRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data tidak valid",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Nama akun wajib diisi",
		})
	}

	if err := h.Repo.CreateAccount(req); err != nil {
		c.Logger().Error("Failed to create account:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Akun berhasil dibuat",
	})
}

func (h *FinanceHandler) UpdateAccount(c echo.Context) error {
	id := c.Param("id")
	var req models.CreateFinanceAccountRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data tidak valid",
		})
	}

	if err := h.Repo.UpdateAccount(id, req); err != nil {
		c.Logger().Error("Failed to update account:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memperbarui akun",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Akun berhasil diperbarui",
	})
}

func (h *FinanceHandler) DeleteAccount(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAccount(id); err != nil {
		c.Logger().Error("Failed to delete account:", err)
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Akun berhasil dihapus",
	})
}
