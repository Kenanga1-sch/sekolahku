package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// ============ Kelas (Class Management) ============

func (h *SavingsHandler) GetClassesWithReps(c echo.Context) error {
	list, err := h.Repo.GetClassesWithReps()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list})
}

func (h *SavingsHandler) AssignClassRep(c echo.Context) error {
	classId := c.Param("id")
	var req struct {
		UserID string `json:"userId"`
	}
	c.Bind(&req)
	if err := h.Repo.UpdateClassRep(classId, req.UserID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "PJ Kelas berhasil diupdate"})
}

func (h *SavingsHandler) CreateKelas(c echo.Context) error {
	var req struct {
		Nama      string  `json:"nama"`
		WaliKelas *string `json:"waliKelas"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.CreateKelas(req.Nama, req.WaliKelas); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) UpdateKelas(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Nama      string  `json:"nama"`
		WaliKelas *string `json:"waliKelas"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateKelas(id, req.Nama, req.WaliKelas); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SavingsHandler) DeleteKelas(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteKelas(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
