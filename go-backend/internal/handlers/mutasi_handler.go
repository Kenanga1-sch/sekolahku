package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
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
	list, err := h.Repo.GetMutasiRequests()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
	})
}

func (h *MutasiHandler) CreateMutasiRequest(c echo.Context) error {
	var m models.MutasiRequest
	if err := c.Bind(&m); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	regNum, err := h.Repo.CreateMutasiRequest(m)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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

	err := h.Repo.UpdateMutasiRequestStatus(id, req.StatusApproval, req.TargetClassID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *MutasiHandler) GetMutasiOutRequests(c echo.Context) error {
	list, err := h.Repo.GetMutasiOutRequests()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
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
				"balance":  balance,
				"debt":     debt,
				"status":   map[bool]string{true: "Clear", false: "Check Required"}[balance == 0 && debt == 0],
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

	err := h.Repo.UpdateMutasiOutStatus(id, req.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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

	err := h.Repo.CreateMutasiOutRequest(m)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
	})
}
