package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type EmployeeHandler struct {
	Repo *repository.EmployeeRepository
}

func NewEmployeeHandler(repo *repository.EmployeeRepository) *EmployeeHandler {
	return &EmployeeHandler{Repo: repo}
}

func (h *EmployeeHandler) GetEmployees(c echo.Context) error {
	pageStr := c.QueryParam("page")
	limitStr := c.QueryParam("limit")
	search := c.QueryParam("q")

	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}

	limit := 10
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	res, err := h.Repo.GetEmployees(page, limit, search)
	if err != nil {
		c.Logger().Error("Failed to get employees:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Server Error"})
	}

	return c.JSON(http.StatusOK, res)
}

func (h *EmployeeHandler) CreateEmployee(c echo.Context) error {
	var req models.CreateEmployeeRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if req.Email == "" || req.FullName == "" || req.Role == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Email, Nama, dan Role wajib diisi"})
	}

	if err := h.Repo.CreateEmployee(req); err != nil {
		c.Logger().Error("Failed to create employee:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan data atau Email/NIP sudah terdaftar"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Pegawai berhasil ditambahkan (Password: 123456)",
	})
}
