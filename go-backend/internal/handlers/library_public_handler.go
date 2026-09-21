package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

// PublicLibraryHandler handles read-only queries for public-facing features
type PublicLibraryHandler struct {
	Repo *repository.PublicLibraryRepository
}

func NewPublicLibraryHandler(repo *repository.PublicLibraryRepository) *PublicLibraryHandler {
	return &PublicLibraryHandler{Repo: repo}
}

// GetBooks lists books for public browsing with availability info
func (h *PublicLibraryHandler) GetBooks(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	search := c.QueryParam("search")
	category := c.QueryParam("category")

	books, total, err := h.Repo.GetBooksForPublic(page, perPage, search, category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	
	totalPages := (total + perPage - 1) / perPage
	
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      books,
		"totalItems": total,
		"totalPages": totalPages,
		"page":       page,
	})
}

// GetBook retrieves detailed information for a single book
func (h *PublicLibraryHandler) GetBook(c echo.Context) error {
	id := c.Param("id")
	
	book, err := h.Repo.GetBookDetail(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	
	if book == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Buku tidak ditemukan"})
	}
	
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    book,
	})
}

// GetStats returns public library statistics
func (h *PublicLibraryHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

// CheckAvailability looks up stock count by ISBN without authentication
func (h *PublicLibraryHandler) CheckAvailability(c echo.Context) error {
	isbn := c.Param("isbn")
	
	result, err := h.Repo.CheckAvailability(isbn)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	
	if result == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "ISBN tidak ditemukan dalam katalog"})
	}
	
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}
