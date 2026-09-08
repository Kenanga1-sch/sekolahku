package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

// ============ Letter Templates ============

func (h *EOfficeHandler) GetLetterTemplates(c echo.Context) error {
	q := c.QueryParam("q")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}

	list, total, err := h.Repo.GetLetterTemplates(q, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "total": total, "page": page, "perPage": perPage})
}

func (h *EOfficeHandler) GetLetterTemplateByID(c echo.Context) error {
	id := c.Param("id")
	t, err := h.Repo.GetLetterTemplateByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Template tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, t)
}

func (h *EOfficeHandler) CreateLetterTemplate(c echo.Context) error {
	t, err := bindLetterTemplate(c, false)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	id, err := h.Repo.CreateLetterTemplate(t)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *EOfficeHandler) UpdateLetterTemplate(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID template wajib diisi"})
	}
	t, err := bindLetterTemplate(c, true)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	if err := h.Repo.UpdateLetterTemplate(id, t); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Template tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *EOfficeHandler) DeleteLetterTemplate(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteLetterTemplate(id); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Template tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *EOfficeHandler) GetTemplateVariables(c echo.Context) error {
	id := c.Param("id")
	vars, err := h.Repo.GetTemplateVariables(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": vars})
}

func (h *EOfficeHandler) ImportLetterTemplate(c echo.Context) error {
	t, err := bindLetterTemplate(c, false)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	id, err := h.Repo.CreateLetterTemplate(t)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *EOfficeHandler) GenerateBatch(c echo.Context) error {
	var req struct {
		TemplateID         string `json:"templateId"`
		ClassificationCode string `json:"classificationCode"`
		MailNumber         string `json:"mailNumber"`
		DateOfLetter       string `json:"dateOfLetter"`
		Recipients         []struct {
			Name    string `json:"name"`
			Address string `json:"address"`
		} `json:"recipients"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	results := make([]interface{}, 0)
	for _, recipient := range req.Recipients {
		results = append(results, map[string]interface{}{
			"recipient": recipient.Name,
			"status":    "generated",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"results": results,
		"data":    results,
	})
}
