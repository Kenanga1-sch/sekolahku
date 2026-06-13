package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type LoanHandler struct {
	Repo *repository.LoanRepository
}

func NewLoanHandler(repo *repository.LoanRepository) *LoanHandler {
	return &LoanHandler{Repo: repo}
}

func (h *LoanHandler) GetLoans(c echo.Context) error {
	borrowerType := c.QueryParam("type")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))

	list, total, err := h.Repo.GetLoans(borrowerType, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "total": total, "page": page, "perPage": perPage})
}

func (h *LoanHandler) CreateLoan(c echo.Context) error {
	var req models.CreateLoanRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.CreateLoan(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "message": "Pengajuan hutang berhasil dibuat"})
}

func (h *LoanHandler) ApproveLoan(c echo.Context) error {
	id := c.Param("id")
	userId := c.Get("userId").(string) // Assumes middleware sets this
	var req models.ApproveLoanRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.ApproveLoan(id, req, userId); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Hutang disetujui & dana dicairkan"})
}

func (h *LoanHandler) AddPayment(c echo.Context) error {
	id := c.Param("id")
	userId := c.Get("userId").(string)
	var req models.AddPaymentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.AddPayment(id, req, userId); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Pembayaran berhasil dicatat"})
}

func (h *LoanHandler) RejectLoan(c echo.Context) error {
	id := c.Param("id")
	var req struct{Reason string `json:"reason"`}
	c.Bind(&req)
	if err := h.Repo.RejectLoan(id, req.Reason); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Hutang ditolak"})
}
