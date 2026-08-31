package handlers

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

var (
	nisnRegex      = regexp.MustCompile(`^[0-9]{10}$`)
	whatsappRegex  = regexp.MustCompile(`^[0-9]{9,15}$`)
)

type MutasiHandler struct {
	Repo        *repository.MutasiRepository
	LibraryRepo *repository.LibraryRepository
	SavingsRepo *repository.SavingsRepository
}

func NewMutasiHandler(repo *repository.MutasiRepository, lib *repository.LibraryRepository, sav *repository.SavingsRepository) *MutasiHandler {
	return &MutasiHandler{
		Repo:        repo,
		LibraryRepo: lib,
		SavingsRepo: sav,
	}
}

func (h *MutasiHandler) GetMutasiRequests(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	month := c.QueryParam("month")

	list, total, err := h.Repo.GetMutasiRequests(page, perPage, month)
	if err != nil {
		log.Printf("ERROR GetMutasiRequests: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal memuat data mutasi masuk"})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
		"total":   total,
		"page":    page,
		"perPage": perPage,
	})
}

func (h *MutasiHandler) CreateMutasiRequest(c echo.Context) error {
	var m models.MutasiRequest
	if err := c.Bind(&m); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	m.StudentName = strings.TrimSpace(m.StudentName)
	m.NISN = strings.TrimSpace(m.NISN)
	m.OriginSchool = strings.TrimSpace(m.OriginSchool)
	m.ParentName = strings.TrimSpace(m.ParentName)
	m.WhatsappNumber = strings.TrimSpace(m.WhatsappNumber)
	if m.StudentName == "" || m.NISN == "" || m.OriginSchool == "" || m.ParentName == "" || m.WhatsappNumber == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data mutasi masuk belum lengkap"})
	}
	if !nisnRegex.MatchString(m.NISN) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "NISN harus 10 digit angka"})
	}
	if m.Gender != "L" && m.Gender != "P" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Jenis kelamin tidak valid"})
	}
	if !whatsappRegex.MatchString(m.WhatsappNumber) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nomor WhatsApp tidak valid (format: 08xxxxxxxxxx)"})
	}
	if m.TargetGrade < 1 || m.TargetGrade > 6 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Kelas tujuan tidak valid"})
	}

	// Tolak NISN yang sudah terdaftar/ diproses supaya tidak dobel data
	existing, err := h.Repo.GetMutasiRequestByNISN(m.NISN)
	if err != nil {
		log.Printf("ERROR cek NISN mutasi masuk: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal memeriksa NISN"})
	}
	if existing != "" {
		return c.JSON(http.StatusConflict, map[string]string{"error": "NISN sudah terdaftar sebagai siswa atau sedang dalam proses mutasi"})
	}

	regNum, err := h.Repo.CreateMutasiRequest(m)
	if err != nil {
		log.Printf("ERROR CreateMutasiRequest: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan permohonan"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success":            true,
		"registrationNumber": regNum,
	})
}

func (h *MutasiHandler) UpdateMutasiRequest(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		StatusApproval string  `json:"statusApproval"`
		TargetClassID  *string `json:"targetClassId"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	req.StatusApproval = strings.TrimSpace(req.StatusApproval)
	if req.StatusApproval != "pending" && req.StatusApproval != "verified" && req.StatusApproval != "rejected" && req.StatusApproval != "principal_approved" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Status mutasi masuk tidak valid"})
	}
	if req.StatusApproval == "principal_approved" && (req.TargetClassID == nil || strings.TrimSpace(*req.TargetClassID) == "") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Kelas penempatan wajib dipilih sebelum disetujui"})
	}

	err := h.Repo.UpdateMutasiRequestStatus(id, req.StatusApproval, req.TargetClassID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Permohonan tidak ditemukan"})
		}
		log.Printf("ERROR UpdateMutasiRequestStatus id=%s: %v", id, err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *MutasiHandler) GetMutasiOutRequests(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	month := c.QueryParam("month")

	list, total, err := h.Repo.GetMutasiOutRequests(page, perPage, month)
	if err != nil {
		log.Printf("ERROR GetMutasiOutRequests: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal memuat data mutasi keluar"})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
		"total":   total,
		"page":    page,
		"perPage": perPage,
	})
}

func (h *MutasiHandler) CheckStudentLiability(c echo.Context) error {
	id := c.Param("id")
	// 1. Get Mutasi request to find student_id
	m, err := h.Repo.GetMutasiOutByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Permohonan tidak ditemukan"})
	}

	// 2. Check Library
	activeLoans, err := h.LibraryRepo.GetActiveLoansCountByStudentID(m.StudentID)
	if err != nil {
		activeLoans = 0
	}

	// 3. Check Savings & Debt
	balance, debt, err := h.SavingsRepo.GetStudentFinancialClearance(m.StudentID)
	if err != nil {
		balance = 0
		debt = 0
	}

	// 4. Return combined data
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"library": map[string]interface{}{
				"activeLoans": activeLoans,
				"status":      map[bool]string{true: "Clear", false: "Uncleared"}[activeLoans == 0],
			},
			"financial": map[string]interface{}{
				"balance": balance,
				"debt":    debt,
				"status":  map[bool]string{true: "Clear", false: "Check Required"}[balance == 0 && debt == 0],
			},
		},
	})
}

func (h *MutasiHandler) UpdateMutasiOutStatus(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Status string `json:"status"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	req.Status = strings.TrimSpace(req.Status)
	if req.Status != "draft" && req.Status != "processed" && req.Status != "completed" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Status mutasi keluar tidak valid"})
	}

	err := h.Repo.UpdateMutasiOutStatus(id, req.Status)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Permohonan tidak ditemukan"})
		}
		log.Printf("ERROR UpdateMutasiOutStatus id=%s: %v", id, err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *MutasiHandler) GetPublicMutasiStatus(c echo.Context) error {
	regNum := c.Param("regNum")
	nisn := c.QueryParam("nisn")

	if regNum == "" || nisn == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Registrasi dan NISN wajib diisi"})
	}

	m, err := h.Repo.GetMutasiRequestByRegNum(regNum, nisn)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Permohonan tidak ditemukan"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    m,
	})
}

func (h *MutasiHandler) ValidatePublicMutasiOut(c echo.Context) error {
	var req struct {
		NISN      string `json:"nisn"`
		BirthDate string `json:"birthDate"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if strings.TrimSpace(req.NISN) == "" || strings.TrimSpace(req.BirthDate) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "NISN dan tanggal lahir wajib diisi"})
	}

	s, err := h.Repo.GetStudentForPublicValidation(req.NISN, req.BirthDate)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Data siswa tidak ditemukan atau tidak aktif"})
	}

	schoolName := h.Repo.GetSchoolName()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"id":         s.ID,
			"fullName":   s.FullName,
			"nisn":       s.NISN,
			"className":  s.ClassName,
			"parentName": s.ParentName,
			"schoolName": schoolName,
		},
	})
}

func (h *MutasiHandler) CreatePublicMutasiOutRequest(c echo.Context) error {
	var m models.MutasiOutRequest
	if err := c.Bind(&m); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if strings.TrimSpace(m.StudentID) == "" || strings.TrimSpace(m.DestinationSchool) == "" || strings.TrimSpace(m.Reason) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data mutasi keluar belum lengkap"})
	}

	err := h.Repo.CreateMutasiOutRequest(m)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
	})
}

func (h *MutasiHandler) GetMutasiLogs(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	month := c.QueryParam("month")

	list, total, err := h.Repo.GetMutasiLogs(page, perPage, month)
	if err != nil {
		log.Printf("ERROR GetMutasiLogs: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal memuat buku mutasi"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
		"total":   total,
	})
}

func (h *MutasiHandler) GetMutasiRekap(c echo.Context) error {
	monthStr := c.QueryParam("month") // format: "2025-07"
	if monthStr == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Parameter month wajib diisi (format: YYYY-MM)"})
	}

	parts := strings.Split(monthStr, "-")
	if len(parts) != 2 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Format month tidak valid (gunakan YYYY-MM)"})
	}

	year, err1 := strconv.Atoi(parts[0])
	month, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || month < 1 || month > 12 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Format month tidak valid"})
	}

	// monthStart = first day of month 00:00:00 UTC in milliseconds
	monthStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	// monthEnd = last day of month 23:59:59 UTC in milliseconds
	monthEnd := time.Date(year, time.Month(month)+1, 1, 0, 0, 0, 0, time.UTC).Add(-time.Millisecond).UnixMilli()

	items, err := h.Repo.GetMutasiRekap(monthStart, monthEnd)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    items,
	})
}

func (h *MutasiHandler) DirectMutasiMasuk(c echo.Context) error {
	var payload struct {
		Student      models.Student `json:"student"`
		Reason       string         `json:"reason"`
		OriginNis    string         `json:"originNis"`
		OriginClass  string         `json:"originClass"`
		ApprovalDate string         `json:"approvalDate"`
		ApprovalNo   string         `json:"approvalNo"`
		MutationDate int64          `json:"mutationDate"`
	}
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if payload.Student.FullName == "" || payload.Student.NISN == nil || *payload.Student.NISN == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama dan NISN wajib diisi"})
	}

	err := h.Repo.DirectMutasiMasuk(
		payload.Student, payload.Reason,
		payload.OriginNis, payload.OriginClass,
		payload.ApprovalDate, payload.ApprovalNo,
		payload.MutationDate,
	)
	if err != nil {
		log.Printf("ERROR DirectMutasiMasuk: %v", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Mutasi masuk berhasil diproses",
	})
}

func (h *MutasiHandler) DirectMutasiKeluar(c echo.Context) error {
	var payload struct {
		StudentID        string `json:"studentId"`
		DestinationSchool string `json:"destinationSchool"`
		DestinationClass string `json:"destinationClass"`
		LetterNo         string `json:"letterNo"`
		Reason           string `json:"reason"`
		MutationDate     int64  `json:"mutationDate"`
	}
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if payload.StudentID == "" || payload.DestinationSchool == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID Siswa dan Sekolah Tujuan wajib diisi"})
	}

	err := h.Repo.DirectMutasiKeluar(
		payload.StudentID, payload.DestinationSchool,
		payload.DestinationClass, payload.LetterNo,
		payload.Reason, payload.MutationDate,
	)
	if err != nil {
		log.Printf("ERROR DirectMutasiKeluar student=%s: %v", payload.StudentID, err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Mutasi keluar berhasil diproses",
	})
}
