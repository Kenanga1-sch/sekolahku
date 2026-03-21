package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AcademicAdvHandler struct {
	Repo *repository.AcademicAdvRepository
}

func NewAcademicAdvHandler(repo *repository.AcademicAdvRepository) *AcademicAdvHandler {
	return &AcademicAdvHandler{Repo: repo}
}

func (h *AcademicAdvHandler) RecordQRScan(c echo.Context) error {
	var req models.AttendanceScanRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	res, err := h.Repo.RecordQRScan(req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "student already recorded in this session" {
			statusCode = http.StatusConflict
		} else if err.Error() == "student not found with this QR code" || err.Error() == "no active session found for this student's class" {
			statusCode = http.StatusNotFound
		}

		c.Logger().Error("Failed to record attendance via scan:", err)
		return c.JSON(statusCode, map[string]string{"error": err.Error()})
	}

	res["message"] = "Attendance recorded successfully"
	res["success"] = true
	return c.JSON(http.StatusOK, res)
}

func (h *AcademicAdvHandler) BulkGrades(c echo.Context) error {
	var req models.BulkGradeRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if err := h.Repo.UpsertBulkGrades(req); err != nil {
		c.Logger().Error("Failed to bulk upsert student grades:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
