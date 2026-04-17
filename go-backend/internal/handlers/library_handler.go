package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type LibraryHandler struct {
	Repo *repository.LibraryRepository
}

func NewLibraryHandler(repo *repository.LibraryRepository) *LibraryHandler {
	return &LibraryHandler{Repo: repo}
}

func (h *LibraryHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

func (h *LibraryHandler) GetBooks(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 {
		perPage = 20
	}
	search := c.QueryParam("search")
	category := c.QueryParam("category")

	items, total, err := h.Repo.GetBooks(page, perPage, search, category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	totalPages := (total + perPage - 1) / perPage

	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      items,
		"totalItems": total,
		"totalPages": totalPages,
		"page":       page,
	})
}

func (h *LibraryHandler) CreateBook(c echo.Context) error {
	var input map[string]interface{}
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.CreateBook(input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) UpdateBook(c echo.Context) error {
	id := c.Param("id")
	var input map[string]interface{}
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.UpdateBook(id, input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) DeleteBook(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteBook(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) SwapQR(c echo.Context) error {
	var req struct {
		OldQr string `json:"oldQr"`
		NewQr string `json:"newQr"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.SwapQR(req.OldQr, req.NewQr); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) GetMembers(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 {
		perPage = 20
	}
	search := c.QueryParam("search")

	items, total, err := h.Repo.GetMembers(page, perPage, search)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	totalPages := (total + perPage - 1) / perPage

	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      items,
		"totalItems": total,
		"totalPages": totalPages,
		"page":       page,
	})
}

func (h *LibraryHandler) CreateMember(c echo.Context) error {
	var m models.LibraryMember
	if err := c.Bind(&m); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.CreateMember(m); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) UpdateMember(c echo.Context) error {
	id := c.Param("id")
	var input map[string]interface{}
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.UpdateMember(id, input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) DeleteMember(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteMember(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) SyncLibrary(c echo.Context) error {
	count, err := h.Repo.SyncFromStudents()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": strconv.Itoa(count) + " anggota berhasil disinkronisasi",
	})
}

func (h *LibraryHandler) GetLoans(c echo.Context) error {
	loanType := c.QueryParam("type")
	loans, err := h.Repo.GetLoans(loanType)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	// Note: PeminjamanPage expects different return structure for active vs overdue based on current code
	// but let's just return the list.
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      loans,
		"totalItems": len(loans),
	})
}

func (h *LibraryHandler) BorrowBook(c echo.Context) error {
	var req struct {
		MemberID string `json:"memberId"`
		ItemID   string `json:"itemId"`
		LoanDays int    `json:"loanDays"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if req.MemberID == "" || req.ItemID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "MemberID and ItemID are required"})
	}

	loan, err := h.Repo.BorrowItem(req.MemberID, req.ItemID, req.LoanDays)
	if err != nil {
		c.Logger().Error("Failed to borrow library asset:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    loan,
	})
}

func (h *LibraryHandler) ReturnBook(c echo.Context) error {
	loanID := c.Param("id")
	if loanID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Loan ID is required"})
	}

	loan, err := h.Repo.ReturnItem(loanID)
	if err != nil {
		c.Logger().Error("Failed to return library asset:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    loan,
	})
}
