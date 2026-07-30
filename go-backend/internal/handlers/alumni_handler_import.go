package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/shared"
)

func (h *AlumniHandler) GraduateStudents(c echo.Context) error {
	var req struct {
		StudentIDs         []string `json:"studentIds"`
		GraduationYear    string   `json:"graduationYear"`
		GraduationDate    string   `json:"graduationDate"`
		DeactivateStudents bool     `json:"deactivateStudents"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	if len(req.StudentIDs) == 0 {
		return shared.BadRequest(c, "Pilih minimal satu siswa")
	}

	gradDate, err := shared.ParseOptionalDate(req.GraduationDate)
	if err != nil {
		return shared.BadRequest(c, err.Error())
	}

	alumni, created, deactivated, err := h.Repo.GraduateStudents(req.StudentIDs, req.GraduationYear, gradDate, req.DeactivateStudents)
	if err != nil {
		return shared.InternalError(c)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true, "alumni": alumni, "created": created, "deactivated": deactivated,
	})
}

func (h *AlumniHandler) ImportBulkAlumni(c echo.Context) error {
	var req struct {
		Alumni []models.Alumni `json:"alumni"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload format"})
	}
	if len(req.Alumni) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tidak ada data Buku Induk untuk diimport"})
	}

	inserted, updated, logs, err := h.Repo.ImportBulkAlumni(req.Alumni)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true, "inserted": inserted, "updated": updated, "logs": logs,
	})
}

func (h *AlumniHandler) ImportBulkGrades(c echo.Context) error {
	var req struct {
		Grades []models.ImportGradeRow `json:"grades"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload format"})
	}
	if len(req.Grades) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tidak ada data nilai untuk diimport"})
	}

	inserted, updated, logs, err := h.Repo.ImportBulkGrades(req.Grades)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true, "inserted": inserted, "updated": updated, "logs": logs,
	})
}
