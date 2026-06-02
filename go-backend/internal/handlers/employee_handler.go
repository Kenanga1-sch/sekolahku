package handlers

import (
	"net/http"
	"strconv"
	"strings"

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

func (h *EmployeeHandler) BulkImportEmployees(c echo.Context) error {
	var req struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if len(req.Data) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tidak ada data GTK untuk diimport"})
	}

	successCount := 0
	errors := []string{}
	for index, row := range req.Data {
		fullName := importString(row, "NamaLengkap", "fullName", "FullName", "nama", "Nama")
		email := strings.ToLower(importString(row, "Email", "email"))
		role := strings.ToLower(importString(row, "Role", "role"))
		if role == "" {
			role = "guru"
		}
		if role != "admin" && role != "guru" && role != "staff" {
			errors = append(errors, "Baris "+strconv.Itoa(index+1)+": role harus admin, guru, atau staff")
			continue
		}
		if fullName == "" || email == "" {
			errors = append(errors, "Baris "+strconv.Itoa(index+1)+": nama dan email wajib diisi")
			continue
		}

		req := models.CreateEmployeeRequest{
			FullName:         fullName,
			Email:            email,
			Role:             role,
			NIP:              optionalImportStringPtr(importString(row, "NIP", "nip")),
			NUPTK:            optionalImportStringPtr(importString(row, "NUPTK", "nuptk")),
			NIK:              optionalImportStringPtr(importString(row, "NIK", "nik")),
			EmploymentStatus: optionalImportStringPtr(importString(row, "StatusKepegawaian", "employmentStatus")),
			JobType:          optionalImportStringPtr(importString(row, "JenisPTK", "jobType")),
			Phone:            optionalImportStringPtr(importString(row, "NoHP", "phone")),
			JoinDate:         optionalImportStringPtr(importString(row, "TanggalMasuk", "joinDate")),
		}

		if err := h.Repo.CreateEmployee(req); err != nil {
			errors = append(errors, "Baris "+strconv.Itoa(index+1)+": "+err.Error())
			continue
		}
		successCount++
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":      true,
		"successCount": successCount,
		"errors":       errors,
	})
}

func (h *EmployeeHandler) GetEmployeeByID(c echo.Context) error {
	id := c.Param("id")
	e, err := h.Repo.GetEmployeeByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Pegawai tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, e)
}

func (h *EmployeeHandler) UpdateEmployee(c echo.Context) error {
	id := c.Param("id")
	var req models.CreateEmployeeRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if err := h.Repo.UpdateEmployee(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal memperbarui data"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *EmployeeHandler) DeleteEmployee(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteEmployee(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus data"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
