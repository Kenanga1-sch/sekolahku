package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	"github.com/sekolahku/go-backend/internal/shared"
)

type AlumniHandler struct {
	Repo *repository.AlumniRepository
}

func NewAlumniHandler(repo *repository.AlumniRepository) *AlumniHandler {
	return &AlumniHandler{Repo: repo}
}

// alumniPayload embeds the full Alumni model so every form field
// (buku induk extensions, physical register index, etc.) is bound
// instead of silently dropped. GraduationDate is shadowed as string
// because the frontend sends "YYYY-MM-DD" (HTML date input), which
// cannot unmarshal into *time.Time.
type alumniPayload struct {
	models.Alumni
	GraduationDate string `json:"graduationDate"`
}

func (p alumniPayload) ToModel() (models.Alumni, error) {
	a := p.Alumni
	graduationDate, err := shared.ParseOptionalDate(p.GraduationDate)
	if err != nil {
		return models.Alumni{}, err
	}
	a.GraduationDate = graduationDate
	a.FullName = strings.TrimSpace(a.FullName)
	a.GraduationYear = strings.TrimSpace(a.GraduationYear)
	a.Status = strings.TrimSpace(a.Status)
	if a.Status == "" {
		a.Status = "graduated"
	}
	if a.StudentID != nil && *a.StudentID == "" {
		a.StudentID = nil
	}
	return a, nil
}

// resolveStoredFilePath converts a stored path (like "/uploads/...") to a filesystem path.
func resolveStoredFilePath(storedPath string) (string, bool) {
	if storedPath == "" {
		return "", false
	}
	path := strings.TrimPrefix(storedPath, "/")
	if strings.HasPrefix(path, "public/") {
		return path, true
	}
	return "public/" + path, true
}

func (h *AlumniHandler) GetAlumniStats(c echo.Context) error {
	stats, err := h.Repo.GetAlumniStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

func (h *AlumniHandler) GetAlumniGraduationYears(c echo.Context) error {
	years, err := h.Repo.GetAlumniGraduationYears()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": years})
}

func (h *AlumniHandler) GetAlumni(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 20
	}
	items, total, err := h.Repo.GetAlumni(page, limit, c.QueryParam("search"), c.QueryParam("graduationYear"), c.QueryParam("status"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return shared.SuccessListResponse(c, items, total, page, limit)
}

func (h *AlumniHandler) CreateAlumni(c echo.Context) error {
	var payload alumniPayload
	if err := c.Bind(&payload); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	a, err := payload.ToModel()
	if err != nil {
		return shared.BadRequest(c, err.Error())
	}
	if a.FullName == "" {
		return shared.BadRequest(c, "Nama wajib diisi")
	}
	if a.Status == "graduated" && a.GraduationYear == "" {
		return shared.BadRequest(c, "Tahun lulus wajib diisi untuk alumni yang lulus")
	}
	id, err := h.Repo.CreateAlumni(a)
	if err != nil {
		return shared.InternalError(c)
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AlumniHandler) GetAlumniByID(c echo.Context) error {
	alumni, err := h.Repo.GetAlumniByID(c.Param("id"))
	if err != nil {
		return shared.InternalError(c)
	}
	if alumni == nil {
		return shared.NotFound(c, "Alumni tidak ditemukan")
	}
	return shared.SuccessResponse(c, alumni)
}

func (h *AlumniHandler) UpdateAlumni(c echo.Context) error {
	var payload alumniPayload
	if err := c.Bind(&payload); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	a, err := payload.ToModel()
	if err != nil {
		return shared.BadRequest(c, err.Error())
	}
	if a.FullName == "" {
		return shared.BadRequest(c, "Nama wajib diisi")
	}
	if a.Status == "graduated" && a.GraduationYear == "" {
		return shared.BadRequest(c, "Tahun lulus wajib diisi untuk alumni yang lulus")
	}
	if err := h.Repo.UpdateAlumni(c.Param("id"), a); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) DeleteAlumni(c echo.Context) error {
	if err := h.Repo.DeleteAlumni(c.Param("id")); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}
