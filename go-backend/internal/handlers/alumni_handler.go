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

type alumniPayload struct {
	StudentID      string `json:"studentId"`
	NISN            string `json:"nisn"`
	NIS             string `json:"nis"`
	FullName        string `json:"fullName"`
	Gender          string `json:"gender"`
	BirthPlace      string `json:"birthPlace"`
	BirthDate       string `json:"birthDate"`
	GraduationYear  string `json:"graduationYear"`
	GraduationDate  string `json:"graduationDate"`
	FinalClass      string `json:"finalClass"`
	Photo           string `json:"photo"`
	ParentName      string `json:"parentName"`
	ParentPhone     string `json:"parentPhone"`
	CurrentAddress  string `json:"currentAddress"`
	CurrentPhone    string `json:"currentPhone"`
	CurrentEmail    string `json:"currentEmail"`
	NextSchool      string `json:"nextSchool"`
	Status          string `json:"status"`
	Notes           string `json:"notes"`
}

func (p alumniPayload) ToModel() (models.Alumni, error) {
	graduationDate, err := shared.ParseOptionalDate(p.GraduationDate)
	if err != nil {
		return models.Alumni{}, err
	}
	statusVal := strings.TrimSpace(p.Status)
	if statusVal == "" {
		statusVal = "graduated"
	}
	return models.Alumni{
		StudentID:      shared.StringPtr(p.StudentID),
		NISN:           shared.StringPtr(p.NISN),
		NIS:            shared.StringPtr(p.NIS),
		FullName:       strings.TrimSpace(p.FullName),
		Gender:         shared.StringPtr(p.Gender),
		BirthPlace:     shared.StringPtr(p.BirthPlace),
		BirthDate:      shared.StringPtr(p.BirthDate),
		GraduationYear: strings.TrimSpace(p.GraduationYear),
		GraduationDate: graduationDate,
		FinalClass:     shared.StringPtr(p.FinalClass),
		Photo:          shared.StringPtr(p.Photo),
		ParentName:     shared.StringPtr(p.ParentName),
		ParentPhone:    shared.StringPtr(p.ParentPhone),
		CurrentAddress: shared.StringPtr(p.CurrentAddress),
		CurrentPhone:   shared.StringPtr(p.CurrentPhone),
		CurrentEmail:   shared.StringPtr(p.CurrentEmail),
		NextSchool:     shared.StringPtr(p.NextSchool),
		Status:         statusVal,
		Notes:          shared.StringPtr(p.Notes),
	}, nil
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
	if a.FullName == "" || a.GraduationYear == "" {
		return shared.BadRequest(c, "Nama dan tahun lulus wajib diisi")
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
	if a.FullName == "" || a.GraduationYear == "" {
		return shared.BadRequest(c, "Nama dan tahun lulus wajib diisi")
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
