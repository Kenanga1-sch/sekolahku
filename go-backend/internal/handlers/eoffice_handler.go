package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type EOfficeHandler struct {
	Repo *repository.EOfficeRepository
}

func NewEOfficeHandler(repo *repository.EOfficeRepository) *EOfficeHandler {
	return &EOfficeHandler{Repo: repo}
}

func (h *EOfficeHandler) GetArsipStats(c echo.Context) error {
	stats, err := h.Repo.GetArsipStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}


func (h *EOfficeHandler) GetKlasifikasi(c echo.Context) error {
	list, err := h.Repo.GetKlasifikasi()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *EOfficeHandler) Numbering(c echo.Context) error {
	var req models.NumberingRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	nextSeq, err := h.Repo.CalculateNextLetterSequence(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": nextSeq})
}

func (h *EOfficeHandler) Increment(c echo.Context) error {
	var req models.IncrementRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}
	if err := h.Repo.IncrementLetterSequence(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "newSequence": req.SequenceNumber})
}

// Surat Masuk
func (h *EOfficeHandler) GetSuratMasuk(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(c.QueryParam("perPage"))
	if limit < 1 { limit = 20 }
	search := c.QueryParam("search")

	items, total, err := h.Repo.GetSuratMasuk(page, limit, search)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      items,
		"totalItems": total,
		"totalPages": (total + limit - 1) / limit,
	})
}

func (h *EOfficeHandler) CreateSuratMasuk(c echo.Context) error {
	var s models.SuratMasuk
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	id, err := h.Repo.CreateSuratMasuk(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": id, "success": "true"})
}

// Surat Keluar
func (h *EOfficeHandler) GetSuratKeluar(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(c.QueryParam("perPage"))
	if limit < 1 { limit = 20 }
	search := c.QueryParam("search")

	items, total, err := h.Repo.GetSuratKeluar(page, limit, search)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      items,
		"totalItems": total,
		"totalPages": (total + limit - 1) / limit,
	})
}


// GetPublicAnnouncements moved to AnnouncementHandler



func (h *EOfficeHandler) GetLetterTemplates(c echo.Context) error {
	q := c.QueryParam("q")
	list, err := h.Repo.GetLetterTemplates(q)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": list})
}

func (h *EOfficeHandler) GetLetterTemplateByID(c echo.Context) error {
	id := c.Param("id")
	t, err := h.Repo.GetLetterTemplateByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Template not found"})
	}
	return c.JSON(http.StatusOK, t)
}

func (h *EOfficeHandler) CreateLetterTemplate(c echo.Context) error {
	var t models.LetterTemplate
	if err := c.Bind(&t); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	id, err := h.Repo.CreateLetterTemplate(t)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *EOfficeHandler) DeleteLetterTemplate(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteLetterTemplate(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
