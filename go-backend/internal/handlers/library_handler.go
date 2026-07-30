package handlers

import (
	"database/sql"
	"errors"
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

// ============ Stats ============

func (h *LibraryHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

// ============ Books CRUD ============

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
	statusFilter := c.QueryParam("status")

	items, total, err := h.Repo.GetBooks(page, perPage, search, category, statusFilter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
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
	var input models.CreateBookRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.CreateBook(input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) UpdateBook(c echo.Context) error {
	id := c.Param("id")
	var input models.UpdateBookRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.UpdateBook(id, input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) DeleteBook(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteBook(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) LookupISBN(c echo.Context) error {
	data, err := h.Repo.LookupISBN(c.Param("isbn"))
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, map[string]string{"error": "not_found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    data,
	})
}

func (h *LibraryHandler) GetBookByQRCode(c echo.Context) error {
	item, err := h.Repo.GetAssetByCode(c.Param("code"))
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Buku tidak ditemukan"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, item)
}
