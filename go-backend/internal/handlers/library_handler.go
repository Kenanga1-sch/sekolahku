package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

type LibraryHandler struct {
	Repo *repository.LibraryRepository
}

func NewLibraryHandler(repo *repository.LibraryRepository) *LibraryHandler {
	return &LibraryHandler{Repo: repo}
}

type BorrowRequest struct {
	MemberID string `json:"memberId"`
	ItemID   string `json:"itemId"`
	LoanDays int    `json:"loanDays"`
}

func (h *LibraryHandler) BorrowBook(c echo.Context) error {
	var req BorrowRequest
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
