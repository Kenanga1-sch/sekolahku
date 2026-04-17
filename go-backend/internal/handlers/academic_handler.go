package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AcademicHandler struct {
	Repo *repository.AcademicRepository
}

func NewAcademicHandler(repo *repository.AcademicRepository) *AcademicHandler {
	return &AcademicHandler{Repo: repo}
}

func (h *AcademicHandler) GetActiveAcademicYear(c echo.Context) error {
	activeYear, err := h.Repo.GetActiveAcademicYear()
	
	if err != nil {
		c.Logger().Error("Failed to get active academic year:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Failed to get active academic year",
		})
	}

	// Returns exactly what Next.js expects: { success: true, data: "2024/2025" }
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    activeYear,
	})
}

func (h *AcademicHandler) GetHomepageData(c echo.Context) error {
	year, _ := h.Repo.GetActiveAcademicYear()
	
	// Just return basic info for now, can be expanded
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"activeYear": year,
		"stats": map[string]int{
			"studentCount": 120, // Mock or fetch from student repo
		},
	})
}
func (h *AcademicHandler) GetClasses(c echo.Context) error {
	classes, err := h.Repo.GetClasses()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, classes)
}

func (h *AcademicHandler) CreateClass(c echo.Context) error {
	var cls models.AcademicClass
	if err := c.Bind(&cls); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if cls.ID == "" {
		cls.ID = cuid2.Generate()
	}
	if err := h.Repo.CreateClass(cls); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": cls.ID})
}

func (h *AcademicHandler) UpdateClass(c echo.Context) error {
	id := c.Param("id")
	var cls models.AcademicClass
	if err := c.Bind(&cls); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.UpdateClass(id, cls); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AcademicHandler) DeleteClass(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteClass(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AcademicHandler) ProcessPromotion(c echo.Context) error {
	var req models.PromotionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	if len(req.StudentIds) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Pilih minimal satu siswa"})
	}

	count, err := h.Repo.ProcessPromotion(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"count":   count,
	})
}

// --- ACADEMIC YEARS ---

func (h *AcademicHandler) GetAcademicYears(c echo.Context) error {
	results, err := h.Repo.GetAcademicYears()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, results)
}

func (h *AcademicHandler) CreateAcademicYear(c echo.Context) error {
	var y models.AcademicYear
	if err := c.Bind(&y); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if y.ID == "" {
		y.ID = cuid2.Generate()
	}
	if err := h.Repo.CreateAcademicYear(y); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": y.ID})
}

func (h *AcademicHandler) UpdateAcademicYear(c echo.Context) error {
	id := c.Param("id")
	var y models.AcademicYear
	if err := c.Bind(&y); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.UpdateAcademicYear(id, y); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AcademicHandler) DeleteAcademicYear(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAcademicYear(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// --- SUBJECTS ---

func (h *AcademicHandler) GetSubjects(c echo.Context) error {
	results, err := h.Repo.GetSubjects()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, results)
}

func (h *AcademicHandler) CreateSubject(c echo.Context) error {
	var s models.Subject
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if s.ID == "" {
		s.ID = cuid2.Generate()
	}
	if err := h.Repo.CreateSubject(s); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": s.ID})
}

func (h *AcademicHandler) UpdateSubject(c echo.Context) error {
	id := c.Param("id")
	var s models.Subject
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.UpdateSubject(id, s); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AcademicHandler) DeleteSubject(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteSubject(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AcademicHandler) GetClassesStats(c echo.Context) error {
	stats, err := h.Repo.GetClassesWithStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}
