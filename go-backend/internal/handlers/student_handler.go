package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type StudentHandler struct {
	Repo *repository.StudentRepository
}

func NewStudentHandler(repo *repository.StudentRepository) *StudentHandler {
	return &StudentHandler{Repo: repo}
}

func (h *StudentHandler) GetStudents(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 { limit = 10 }
	query := c.QueryParam("q")
	status := c.QueryParam("status")

	res, err := h.Repo.GetStudents(page, limit, query, status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    res,
	})
}

func (h *StudentHandler) GetStudentByID(c echo.Context) error {
	id := c.Param("id")
	s, err := h.Repo.GetStudentByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Siswa tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    s,
	})
}

func (h *StudentHandler) CreateStudent(c echo.Context) error {
	var s models.Student
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	
	if s.FullName == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nama lengkap harus diisi"})
	}

	id, err := h.Repo.CreateStudent(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *StudentHandler) UpdateStudent(c echo.Context) error {
	id := c.Param("id")
	var s models.Student
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	err := h.Repo.UpdateStudent(id, s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *StudentHandler) DeleteStudent(c echo.Context) error {
	id := c.Param("id")
	err := h.Repo.DeleteStudent(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *StudentHandler) GetStudentsForPrint(c echo.Context) error {
	var req struct {
		StudentIds []string `json:"studentIds"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	students, err := h.Repo.GetStudentsByIDs(req.StudentIds)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    students,
	})
}

func (h *StudentHandler) GetClasses(c echo.Context) error {
	classes, err := h.Repo.GetClasses()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    classes,
	})
}

func (h *StudentHandler) SimpleSearch(c echo.Context) error {
	q := c.QueryParam("q")
	className := c.QueryParam("className")
	students, err := h.Repo.SimpleSearch(q, className)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": students})
}
