package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AlumniHandler struct {
	Repo *repository.AlumniRepository
}

func NewAlumniHandler(repo *repository.AlumniRepository) *AlumniHandler {
	return &AlumniHandler{Repo: repo}
}

type alumniPayload struct {
	StudentID      string `json:"studentId"`
	NISN           string `json:"nisn"`
	NIS            string `json:"nis"`
	FullName       string `json:"fullName"`
	Gender         string `json:"gender"`
	BirthPlace     string `json:"birthPlace"`
	BirthDate      string `json:"birthDate"`
	GraduationYear string `json:"graduationYear"`
	GraduationDate string `json:"graduationDate"`
	FinalClass     string `json:"finalClass"`
	Photo          string `json:"photo"`
	ParentName     string `json:"parentName"`
	ParentPhone    string `json:"parentPhone"`
	CurrentAddress string `json:"currentAddress"`
	CurrentPhone   string `json:"currentPhone"`
	CurrentEmail   string `json:"currentEmail"`
	NextSchool     string `json:"nextSchool"`
	Notes          string `json:"notes"`
}

func stringPtr(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func parseOptionalDate(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return &parsed, nil
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return &parsed, nil
	}
	return nil, fmt.Errorf("format tanggal tidak valid")
}

func (p alumniPayload) ToModel() (models.Alumni, error) {
	graduationDate, err := parseOptionalDate(p.GraduationDate)
	if err != nil {
		return models.Alumni{}, err
	}
	return models.Alumni{
		StudentID:      stringPtr(p.StudentID),
		NISN:           stringPtr(p.NISN),
		NIS:            stringPtr(p.NIS),
		FullName:       strings.TrimSpace(p.FullName),
		Gender:         stringPtr(p.Gender),
		BirthPlace:     stringPtr(p.BirthPlace),
		BirthDate:      stringPtr(p.BirthDate),
		GraduationYear: strings.TrimSpace(p.GraduationYear),
		GraduationDate: graduationDate,
		FinalClass:     stringPtr(p.FinalClass),
		Photo:          stringPtr(p.Photo),
		ParentName:     stringPtr(p.ParentName),
		ParentPhone:    stringPtr(p.ParentPhone),
		CurrentAddress: stringPtr(p.CurrentAddress),
		CurrentPhone:   stringPtr(p.CurrentPhone),
		CurrentEmail:   stringPtr(p.CurrentEmail),
		NextSchool:     stringPtr(p.NextSchool),
		Notes:          stringPtr(p.Notes),
	}, nil
}

func resolveStoredFilePath(storedPath string) (string, bool) {
	trimmed := strings.TrimSpace(storedPath)
	if trimmed == "" {
		return "", false
	}

	normalized := filepath.Clean(filepath.FromSlash(strings.TrimPrefix(trimmed, "/")))
	if normalized == "." || strings.HasPrefix(normalized, "..") || filepath.IsAbs(normalized) {
		return "", false
	}

	candidates := []string{normalized}
	if strings.HasPrefix(normalized, "uploads"+string(filepath.Separator)) {
		rel := strings.TrimPrefix(normalized, "uploads"+string(filepath.Separator))
		candidates = append(candidates,
			filepath.Join("uploads", rel),
			filepath.Join("..", "public", "uploads", rel),
			filepath.Join("public", "uploads", rel),
		)
	}

	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err == nil && !info.IsDir() {
			return candidate, true
		}
	}
	return "", false
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
	search := c.QueryParam("search")
	year := c.QueryParam("graduationYear")

	items, total, err := h.Repo.GetAlumni(page, limit, search, year)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": items,
		"pagination": map[string]interface{}{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": (total + limit - 1) / limit,
		},
	})
}

func (h *AlumniHandler) GetAlumniByID(c echo.Context) error {
	id := c.Param("id")
	alumni, err := h.Repo.GetAlumniByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Alumni not found"})
	}
	if alumni == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Alumni not found"})
	}
	return c.JSON(http.StatusOK, alumni)
}

func (h *AlumniHandler) CreateAlumni(c echo.Context) error {
	var payload alumniPayload
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	a, err := payload.ToModel()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	if a.FullName == "" || a.GraduationYear == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama dan tahun lulus wajib diisi"})
	}
	id, err := h.Repo.CreateAlumni(a)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "success": true})
}

func (h *AlumniHandler) UpdateAlumni(c echo.Context) error {
	id := c.Param("id")
	var payload alumniPayload
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	a, err := payload.ToModel()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	if a.FullName == "" || a.GraduationYear == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama dan tahun lulus wajib diisi"})
	}
	if err := h.Repo.UpdateAlumni(id, a); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AlumniHandler) GraduateStudents(c echo.Context) error {
	var req struct {
		StudentIDs         []string `json:"studentIds"`
		GraduationYear     string   `json:"graduationYear"`
		GraduationDate     string   `json:"graduationDate"`
		DeactivateStudents bool     `json:"deactivateStudents"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if len(req.StudentIDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Pilih minimal satu siswa"})
	}

	graduationDate, err := parseOptionalDate(req.GraduationDate)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	alumni, created, deactivated, err := h.Repo.GraduateStudents(req.StudentIDs, req.GraduationYear, graduationDate, req.DeactivateStudents)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":     true,
		"alumni":      alumni,
		"created":     created,
		"deactivated": deactivated,
	})
}

func (h *AlumniHandler) DeleteAlumni(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAlumni(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AlumniHandler) GetAlumniStats(c echo.Context) error {
	stats, err := h.Repo.GetAlumniStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *AlumniHandler) GetDocumentTypes(c echo.Context) error {
	list, err := h.Repo.GetDocumentTypes()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
}

func (h *AlumniHandler) CreateDocument(c echo.Context) error {
	alumniID := c.Param("id")
	docTypeID := c.FormValue("documentTypeId")
	if strings.TrimSpace(docTypeID) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Jenis dokumen wajib dipilih"})
	}

	// Handle Multipart Form
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File is required"})
	}

	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	// Destination
	uploadDir := filepath.Join("uploads", "alumni", alumniID)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return err
	}

	filename := fmt.Sprintf("%d_%s", time.Now().Unix(), filepath.Base(file.Filename))
	dstPath := filepath.Join(uploadDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return err
	}

	// Save to DB
	docNumber := c.FormValue("documentNumber")
	issueDate := c.FormValue("issueDate")
	notes := c.FormValue("notes")

	doc := models.AlumniDocument{
		AlumniID:       alumniID,
		DocumentTypeID: docTypeID,
		FileName:       file.Filename,
		FilePath:       "/" + filepath.ToSlash(dstPath),
		FileSize:       int(file.Size),
		MimeType:       file.Header.Get("Content-Type"),
	}
	if docNumber != "" {
		doc.DocumentNumber = &docNumber
	}
	if issueDate != "" {
		doc.IssueDate = &issueDate
	}
	if notes != "" {
		doc.Notes = &notes
	}

	if err := h.Repo.CreateDocument(doc); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]bool{"success": true})
}

func (h *AlumniHandler) CreatePickup(c echo.Context) error {
	alumniID := c.Param("id")
	var req struct {
		DocumentTypeID    *string `json:"documentTypeId"`
		RecipientName     string  `json:"recipientName"`
		RecipientRelation string  `json:"recipientRelation"`
		RecipientIDNumber string  `json:"recipientIdNumber"`
		RecipientPhone    string  `json:"recipientPhone"`
		PickupDate        string  `json:"pickupDate"`
		Notes             string  `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if strings.TrimSpace(req.RecipientName) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama penerima wajib diisi"})
	}
	pickupDate, err := parseOptionalDate(req.PickupDate)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	p := models.DocumentPickup{
		AlumniID:          alumniID,
		DocumentTypeID:    req.DocumentTypeID,
		RecipientName:     strings.TrimSpace(req.RecipientName),
		RecipientRelation: stringPtr(req.RecipientRelation),
		RecipientIDNumber: stringPtr(req.RecipientIDNumber),
		RecipientPhone:    stringPtr(req.RecipientPhone),
		PickupDate:        pickupDate,
		Notes:             stringPtr(req.Notes),
	}

	if err := h.Repo.CreatePickup(p); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]bool{"success": true})
}

func (h *AlumniHandler) UploadPhoto(c echo.Context) error {
	alumniID := c.Param("id")
	file, err := c.FormFile("photo")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Foto wajib dipilih"})
	}

	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	ct := http.DetectContentType(buf[:n])
	src.Seek(0, io.SeekStart)

	if ct != "image/jpeg" && ct != "image/png" && ct != "image/webp" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Format foto harus JPG, PNG, atau WebP"})
	}

	uploadDir := filepath.Join("uploads", "alumni", alumniID)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return err
	}

	filename := fmt.Sprintf("photo_%d_%s", time.Now().Unix(), filepath.Base(file.Filename))
	dstPath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return err
	}

	photoPath := "/" + filepath.ToSlash(dstPath)
	if err := h.Repo.UpdatePhoto(alumniID, photoPath); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Alumni tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "photo": photoPath})
}

func (h *AlumniHandler) RemovePhoto(c echo.Context) error {
	alumniID := c.Param("id")
	photoPath, err := h.Repo.RemovePhoto(alumniID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Alumni tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if diskPath, ok := resolveStoredFilePath(photoPath); ok {
		_ = os.Remove(diskPath)
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *AlumniHandler) VerifyDocument(c echo.Context) error {
	var req struct {
		Status string `json:"status"`
		Notes  string `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	req.Status = strings.TrimSpace(req.Status)
	if req.Status != "verified" && req.Status != "rejected" && req.Status != "pending" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Status dokumen tidak valid"})
	}
	if err := h.Repo.VerifyDocument(c.Param("docId"), req.Status, stringPtr(req.Notes)); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Dokumen tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *AlumniHandler) DeleteDocument(c echo.Context) error {
	doc, err := h.Repo.DeleteDocument(c.Param("docId"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Dokumen tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if diskPath, ok := resolveStoredFilePath(doc.FilePath); ok {
		_ = os.Remove(diskPath)
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *AlumniHandler) DownloadDocument(c echo.Context) error {
	doc, err := h.Repo.GetDocumentByID(c.Param("docId"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Dokumen tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	diskPath, ok := resolveStoredFilePath(doc.FilePath)
	if !ok {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File dokumen tidak ditemukan"})
	}
	return c.Attachment(diskPath, doc.FileName)
}

// ───────── Achievements CRUD ─────────

func (h *AlumniHandler) GetAchievements(c echo.Context) error {
	alumniID := c.Param("id")
	list, err := h.Repo.GetAchievements(alumniID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
}

func (h *AlumniHandler) CreateAchievement(c echo.Context) error {
	alumniID := c.Param("id")
	var req struct {
		Type          string  `json:"type"`
		Title         string  `json:"title"`
		Description   *string `json:"description"`
		Level         string  `json:"level"`
		Ranking       *string `json:"ranking"`
		Year          string  `json:"year"`
		Organizer     *string `json:"organizer"`
		CertificateURL *string `json:"certificateUrl"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.Year) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Judul dan tahun prestasi wajib diisi"})
	}
	if req.Type != "academic" && req.Type != "non_academic" {
		req.Type = "academic"
	}
	validLevels := map[string]bool{"school": true, "district": true, "province": true, "national": true, "international": true}
	if !validLevels[req.Level] {
		req.Level = "school"
	}

	a := models.AlumniAchievement{
		AlumniID:      alumniID,
		Type:          req.Type,
		Title:         strings.TrimSpace(req.Title),
		Description:   req.Description,
		Level:         req.Level,
		Ranking:       req.Ranking,
		Year:          strings.TrimSpace(req.Year),
		Organizer:     req.Organizer,
		CertificateURL: req.CertificateURL,
	}
	id, err := h.Repo.CreateAchievement(a)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AlumniHandler) UpdateAchievement(c echo.Context) error {
	id := c.Param("achId")
	var req struct {
		Type          *string `json:"type"`
		Title         *string `json:"title"`
		Description   *string `json:"description"`
		Level         *string `json:"level"`
		Ranking       *string `json:"ranking"`
		Year          *string `json:"year"`
		Organizer     *string `json:"organizer"`
		CertificateURL *string `json:"certificateUrl"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	ach := models.AlumniAchievement{}
	if req.Type != nil { ach.Type = *req.Type }
	if req.Title != nil { ach.Title = strings.TrimSpace(*req.Title) }
	if req.Description != nil { ach.Description = req.Description }
	if req.Level != nil { ach.Level = *req.Level }
	if req.Ranking != nil { ach.Ranking = req.Ranking }
	if req.Year != nil { ach.Year = strings.TrimSpace(*req.Year) }
	if req.Organizer != nil { ach.Organizer = req.Organizer }
	if req.CertificateURL != nil { ach.CertificateURL = req.CertificateURL }

	if err := h.Repo.UpdateAchievement(id, ach); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *AlumniHandler) DeleteAchievement(c echo.Context) error {
	if err := h.Repo.DeleteAchievement(c.Param("achId")); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

// ───────── Extracurriculars CRUD ─────────

func (h *AlumniHandler) GetExtracurriculars(c echo.Context) error {
	alumniID := c.Param("id")
	list, err := h.Repo.GetExtracurriculars(alumniID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
}

func (h *AlumniHandler) CreateExtracurricular(c echo.Context) error {
	alumniID := c.Param("id")
	var req struct {
		ActivityName string  `json:"activityName"`
		Role         *string `json:"role"`
		YearStart    *string `json:"yearStart"`
		YearEnd      *string `json:"yearEnd"`
		Description  *string `json:"description"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if strings.TrimSpace(req.ActivityName) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama kegiatan wajib diisi"})
	}

	e := models.AlumniExtracurricular{
		AlumniID:     alumniID,
		ActivityName: strings.TrimSpace(req.ActivityName),
		Role:         req.Role,
		YearStart:    req.YearStart,
		YearEnd:      req.YearEnd,
		Description:  req.Description,
	}
	id, err := h.Repo.CreateExtracurricular(e)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AlumniHandler) UpdateExtracurricular(c echo.Context) error {
	id := c.Param("exId")
	var req struct {
		ActivityName *string `json:"activityName"`
		Role         *string `json:"role"`
		YearStart    *string `json:"yearStart"`
		YearEnd      *string `json:"yearEnd"`
		Description  *string `json:"description"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	e := models.AlumniExtracurricular{}
	if req.ActivityName != nil { e.ActivityName = strings.TrimSpace(*req.ActivityName) }
	if req.Role != nil { e.Role = req.Role }
	if req.YearStart != nil { e.YearStart = req.YearStart }
	if req.YearEnd != nil { e.YearEnd = req.YearEnd }
	if req.Description != nil { e.Description = req.Description }

	if err := h.Repo.UpdateExtracurricular(id, e); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *AlumniHandler) DeleteExtracurricular(c echo.Context) error {
	if err := h.Repo.DeleteExtracurricular(c.Param("exId")); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
