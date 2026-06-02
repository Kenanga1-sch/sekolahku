package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type StaffProfileHandler struct {
	Repo *repository.StaffProfileRepository
}

func NewStaffProfileHandler(repo *repository.StaffProfileRepository) *StaffProfileHandler {
	return &StaffProfileHandler{Repo: repo}
}

func normalizeStaffProfile(p *models.StaffProfile) string {
	p.Name = strings.TrimSpace(p.Name)
	p.Position = strings.TrimSpace(p.Position)
	p.Category = strings.TrimSpace(p.Category)

	if p.Name == "" {
		return "Nama wajib diisi"
	}
	if p.Position == "" {
		return "Jabatan wajib diisi"
	}

	switch p.Category {
	case "kepsek", "guru", "staff", "support":
	default:
		return "Kategori staff tidak valid"
	}

	if p.DisplayOrder < 0 {
		p.DisplayOrder = 0
	}

	return ""
}

func (h *StaffProfileHandler) GetProfiles(c echo.Context) error {
	search := c.QueryParam("q")
	profiles, err := h.Repo.GetProfiles(search)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, models.StaffProfileResponse{Data: profiles})
}

func (h *StaffProfileHandler) CreateProfile(c echo.Context) error {
	var p models.StaffProfile
	if err := c.Bind(&p); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if validationMessage := normalizeStaffProfile(&p); validationMessage != "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": validationMessage})
	}

	id, err := h.Repo.Create(p)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"id":      id,
	})
}

func (h *StaffProfileHandler) UpdateProfile(c echo.Context) error {
	id := c.Param("id")
	var p models.StaffProfile
	if err := c.Bind(&p); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if validationMessage := normalizeStaffProfile(&p); validationMessage != "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": validationMessage})
	}

	if err := h.Repo.Update(id, p); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Staff tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *StaffProfileHandler) DeleteProfile(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.Delete(id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Staff tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
