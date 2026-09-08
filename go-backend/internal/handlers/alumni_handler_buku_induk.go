package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/shared"
)

// ─── Achievements ───────────────────────────────────────────────

func (h *AlumniHandler) GetAchievements(c echo.Context) error {
	list, err := h.Repo.GetAchievements(c.Param("id"))
	if err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, list)
}

func (h *AlumniHandler) CreateAchievement(c echo.Context) error {
	alumniID := c.Param("id")
	var req struct {
		Type           string  `json:"type"`
		Title          string  `json:"title"`
		Description    *string `json:"description"`
		Level          string  `json:"level"`
		Ranking        *string `json:"ranking"`
		Year           string  `json:"year"`
		Organizer      *string `json:"organizer"`
		CertificateURL *string `json:"certificateUrl"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	if strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.Year) == "" {
		return shared.BadRequest(c, "Judul dan tahun prestasi wajib diisi")
	}
	if req.Type != "academic" && req.Type != "non_academic" {
		req.Type = "academic"
	}
	validLevels := map[string]bool{"school": true, "district": true, "province": true, "national": true, "international": true}
	if !validLevels[req.Level] {
		req.Level = "school"
	}

	a := models.AlumniAchievement{
		AlumniID:       alumniID,
		Type:           req.Type,
		Title:          strings.TrimSpace(req.Title),
		Description:    req.Description,
		Level:          req.Level,
		Ranking:        req.Ranking,
		Year:           strings.TrimSpace(req.Year),
		Organizer:      req.Organizer,
		CertificateURL: req.CertificateURL,
	}
	id, err := h.Repo.CreateAchievement(a)
	if err != nil {
		return shared.InternalError(c)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AlumniHandler) UpdateAchievement(c echo.Context) error {
	var req struct {
		Type           *string `json:"type"`
		Title          *string `json:"title"`
		Description    *string `json:"description"`
		Level          *string `json:"level"`
		Ranking        *string `json:"ranking"`
		Year           *string `json:"year"`
		Organizer      *string `json:"organizer"`
		CertificateURL *string `json:"certificateUrl"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}

	ach := models.AlumniAchievement{}
	if req.Title != nil {
		ach.Title = strings.TrimSpace(*req.Title)
	}
	if req.Description != nil {
		ach.Description = req.Description
	}
	if req.Level != nil {
		ach.Level = *req.Level
	}
	if req.Ranking != nil {
		ach.Ranking = req.Ranking
	}
	if req.Year != nil {
		ach.Year = strings.TrimSpace(*req.Year)
	}
	if req.Organizer != nil {
		ach.Organizer = req.Organizer
	}
	if req.CertificateURL != nil {
		ach.CertificateURL = req.CertificateURL
	}

	if err := h.Repo.UpdateAchievement(c.Param("achId"), ach); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) DeleteAchievement(c echo.Context) error {
	if err := h.Repo.DeleteAchievement(c.Param("achId")); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

// ─── Extracurriculars ──────────────────────────────────────────

func (h *AlumniHandler) GetExtracurriculars(c echo.Context) error {
	list, err := h.Repo.GetExtracurriculars(c.Param("id"))
	if err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, list)
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
		return shared.BadRequest(c, "Input tidak valid")
	}
	if strings.TrimSpace(req.ActivityName) == "" {
		return shared.BadRequest(c, "Nama kegiatan wajib diisi")
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
		return shared.InternalError(c)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AlumniHandler) UpdateExtracurricular(c echo.Context) error {
	var req struct {
		ActivityName *string `json:"activityName"`
		Role         *string `json:"role"`
		YearStart    *string `json:"yearStart"`
		YearEnd      *string `json:"yearEnd"`
		Description  *string `json:"description"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}

	e := models.AlumniExtracurricular{}
	if req.ActivityName != nil {
		e.ActivityName = strings.TrimSpace(*req.ActivityName)
	}
	if req.Role != nil {
		e.Role = req.Role
	}
	if req.YearStart != nil {
		e.YearStart = req.YearStart
	}
	if req.YearEnd != nil {
		e.YearEnd = req.YearEnd
	}
	if req.Description != nil {
		e.Description = req.Description
	}

	if err := h.Repo.UpdateExtracurricular(c.Param("exId"), e); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) DeleteExtracurricular(c echo.Context) error {
	if err := h.Repo.DeleteExtracurricular(c.Param("exId")); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

// ─── Transcripts ───────────────────────────────────────────────

func (h *AlumniHandler) GetTranscripts(c echo.Context) error {
	list, err := h.Repo.GetTranscripts(c.Param("id"))
	if err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, list)
}

func (h *AlumniHandler) CreateTranscript(c echo.Context) error {
	alumniID := c.Param("id")
	var req struct {
		AcademicYear string  `json:"academicYear"`
		Semester     string  `json:"semester"`
		SubjectName  string  `json:"subjectName"`
		SubjectCode  *string `json:"subjectCode"`
		Score        float64 `json:"score"`
		ScoreLetter  *string `json:"scoreLetter"`
		Notes        *string `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	if strings.TrimSpace(req.AcademicYear) == "" || strings.TrimSpace(req.Semester) == "" || strings.TrimSpace(req.SubjectName) == "" {
		return shared.BadRequest(c, "Tahun ajaran, semester, dan mata pelajaran wajib diisi")
	}

	scoreLetter := req.ScoreLetter
	if scoreLetter == nil || *scoreLetter == "" {
		sl := scoreToLetter(req.Score)
		scoreLetter = &sl
	}

	t := models.AlumniTranscript{
		AlumniID:    alumniID,
		AcYear:      strings.TrimSpace(req.AcademicYear),
		Semester:    strings.TrimSpace(req.Semester),
		SubjectName: strings.TrimSpace(req.SubjectName),
		SubjectCode: req.SubjectCode,
		Score:       req.Score,
		ScoreLetter: scoreLetter,
		Notes:       req.Notes,
	}
	id, err := h.Repo.CreateTranscript(t)
	if err != nil {
		return shared.InternalError(c)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AlumniHandler) SaveTranscriptsBulk(c echo.Context) error {
	alumniID := c.Param("id")
	var req struct {
		AcademicYear string `json:"academicYear"`
		Semester     string `json:"semester"`
		Grades       []struct {
			SubjectName string  `json:"subjectName"`
			SubjectCode *string `json:"subjectCode"`
			Score       float64 `json:"score"`
			ScoreLetter *string `json:"scoreLetter"`
			Notes       *string `json:"notes"`
		} `json:"grades"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	if strings.TrimSpace(req.AcademicYear) == "" || strings.TrimSpace(req.Semester) == "" {
		return shared.BadRequest(c, "Tahun ajaran dan semester wajib diisi")
	}

	var transcripts []models.AlumniTranscript
	for _, g := range req.Grades {
		if strings.TrimSpace(g.SubjectName) == "" {
			continue
		}
		scoreLetter := g.ScoreLetter
		if scoreLetter == nil || *scoreLetter == "" {
			sl := scoreToLetter(g.Score)
			scoreLetter = &sl
		}
		transcripts = append(transcripts, models.AlumniTranscript{
			AlumniID:    alumniID,
			AcYear:      strings.TrimSpace(req.AcademicYear),
			Semester:    strings.TrimSpace(req.Semester),
			SubjectName: strings.TrimSpace(g.SubjectName),
			SubjectCode: g.SubjectCode,
			Score:       g.Score,
			ScoreLetter: scoreLetter,
			Notes:       g.Notes,
		})
	}

	if err := h.Repo.SaveTranscriptsBulk(alumniID, strings.TrimSpace(req.AcademicYear), strings.TrimSpace(req.Semester), transcripts); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) UpdateTranscript(c echo.Context) error {
	var req struct {
		AcademicYear *string  `json:"academicYear"`
		Semester     *string  `json:"semester"`
		SubjectName  *string  `json:"subjectName"`
		SubjectCode  *string  `json:"subjectCode"`
		Score        *float64 `json:"score"`
		ScoreLetter  *string  `json:"scoreLetter"`
		Notes        *string  `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}

	t := models.AlumniTranscript{}
	if req.AcademicYear != nil {
		t.AcYear = strings.TrimSpace(*req.AcademicYear)
	}
	if req.Semester != nil {
		t.Semester = strings.TrimSpace(*req.Semester)
	}
	if req.SubjectName != nil {
		t.SubjectName = strings.TrimSpace(*req.SubjectName)
	}
	if req.SubjectCode != nil {
		t.SubjectCode = req.SubjectCode
	}
	if req.Score != nil {
		t.Score = *req.Score
		if req.ScoreLetter == nil || *req.ScoreLetter == "" {
			sl := scoreToLetter(*req.Score)
			t.ScoreLetter = &sl
		}
	}
	if req.ScoreLetter != nil && *req.ScoreLetter != "" {
		t.ScoreLetter = req.ScoreLetter
	}
	if req.Notes != nil {
		t.Notes = req.Notes
	}

	if err := h.Repo.UpdateTranscript(c.Param("transId"), t); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) DeleteTranscript(c echo.Context) error {
	if err := h.Repo.DeleteTranscript(c.Param("transId")); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

// ─── Attendance Summaries ──────────────────────────────────────

func (h *AlumniHandler) GetAttendanceSummaries(c echo.Context) error {
	list, err := h.Repo.GetAttendanceSummaries(c.Param("id"))
	if err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, list)
}

func (h *AlumniHandler) CreateAttendanceSummary(c echo.Context) error {
	alumniID := c.Param("id")
	var req struct {
		AcademicYear string `json:"academicYear"`
		Semester     string `json:"semester"`
		Present      int    `json:"present"`
		Sick         int    `json:"sick"`
		Permission   int    `json:"permission"`
		Absent       int    `json:"absent"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	if strings.TrimSpace(req.AcademicYear) == "" || strings.TrimSpace(req.Semester) == "" {
		return shared.BadRequest(c, "Tahun ajaran dan semester wajib diisi")
	}

	s := models.AlumniAttendanceSummary{
		AlumniID:   alumniID,
		AcYear:     strings.TrimSpace(req.AcademicYear),
		Semester:   strings.TrimSpace(req.Semester),
		Present:    req.Present,
		Sick:       req.Sick,
		Permission: req.Permission,
		Absent:     req.Absent,
	}
	id, err := h.Repo.CreateAttendanceSummary(s)
	if err != nil {
		return shared.InternalError(c)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AlumniHandler) UpdateAttendanceSummary(c echo.Context) error {
	var req struct {
		AcademicYear *string `json:"academicYear"`
		Semester     *string `json:"semester"`
		Present      *int    `json:"present"`
		Sick         *int    `json:"sick"`
		Permission   *int    `json:"permission"`
		Absent       *int    `json:"absent"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}

	s := models.AlumniAttendanceSummary{}
	if req.AcademicYear != nil {
		s.AcYear = strings.TrimSpace(*req.AcademicYear)
	}
	if req.Semester != nil {
		s.Semester = strings.TrimSpace(*req.Semester)
	}
	if req.Present != nil {
		s.Present = *req.Present
	}
	if req.Sick != nil {
		s.Sick = *req.Sick
	}
	if req.Permission != nil {
		s.Permission = *req.Permission
	}
	if req.Absent != nil {
		s.Absent = *req.Absent
	}

	if err := h.Repo.UpdateAttendanceSummary(c.Param("attId"), s); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) DeleteAttendanceSummary(c echo.Context) error {
	if err := h.Repo.DeleteAttendanceSummary(c.Param("attId")); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

// ─── Health Records ────────────────────────────────────────────

func (h *AlumniHandler) GetHealthRecords(c echo.Context) error {
	list, err := h.Repo.GetHealthRecords(c.Param("id"))
	if err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, list)
}

func (h *AlumniHandler) CreateHealthRecord(c echo.Context) error {
	alumniID := c.Param("id")
	var req struct {
		Year        string  `json:"year"`
		Weight      *int    `json:"weight"`
		Height      *int    `json:"height"`
		Illness     *string `json:"illness"`
		Abnormality *string `json:"abnormality"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	if strings.TrimSpace(req.Year) == "" {
		return shared.BadRequest(c, "Tahun / Kelas wajib diisi")
	}

	hr := models.AlumniHealthRecord{
		AlumniID:    alumniID,
		Year:        strings.TrimSpace(req.Year),
		Weight:      req.Weight,
		Height:      req.Height,
		Illness:     req.Illness,
		Abnormality: req.Abnormality,
	}
	id, err := h.Repo.CreateHealthRecord(hr)
	if err != nil {
		return shared.InternalError(c)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AlumniHandler) UpdateHealthRecord(c echo.Context) error {
	var req struct {
		Year        string  `json:"year"`
		Weight      *int    `json:"weight"`
		Height      *int    `json:"height"`
		Illness     *string `json:"illness"`
		Abnormality *string `json:"abnormality"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	if strings.TrimSpace(req.Year) == "" {
		return shared.BadRequest(c, "Tahun / Kelas wajib diisi")
	}

	hr := models.AlumniHealthRecord{
		Year:        strings.TrimSpace(req.Year),
		Weight:      req.Weight,
		Height:      req.Height,
		Illness:     req.Illness,
		Abnormality: req.Abnormality,
	}
	if err := h.Repo.UpdateHealthRecord(c.Param("hrId"), hr); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) DeleteHealthRecord(c echo.Context) error {
	if err := h.Repo.DeleteHealthRecord(c.Param("hrId")); err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}
