package handlers

import (
	"net/http"

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

	if err := h.Repo.Update(id, p); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *StaffProfileHandler) DeleteProfile(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.Delete(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
