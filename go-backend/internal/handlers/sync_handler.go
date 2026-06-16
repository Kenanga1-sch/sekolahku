package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type SyncHandler struct {
	Repo *repository.SyncRepository
}

func NewSyncHandler(repo *repository.SyncRepository) *SyncHandler {
	return &SyncHandler{Repo: repo}
}

type DapodikSyncRequest struct {
	// A simple token for rudimentary protection
	Token    string           `json:"token"`
	Students []models.Student `json:"students"`
}

func (h *SyncHandler) SyncDapodikStudents(c echo.Context) error {
	var req DapodikSyncRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload format"})
	}

	// Basic security check (in production this should be a configurable secure token)
	if req.Token != "dapodisk-secure-sync" {
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "error": "Invalid token"})
	}

	if len(req.Students) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "No students provided"})
	}

	successCount := 0
	for _, student := range req.Students {
		// Ensure required fields
		student.FullName = strings.TrimSpace(student.FullName)
		if student.FullName == "" {
			continue // Skip invalid rows
		}

		if student.ClassName != nil && *student.ClassName != "" {
			h.Repo.EnsureClass(*student.ClassName)
		}

		err := h.Repo.UpsertStudent(student)
		if err == nil {
			successCount++
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Sinkronisasi Dapodik berhasil",
		"synced":  successCount,
		"total":   len(req.Students),
	})
}
