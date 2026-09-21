package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type BookingHandler struct {
	Repo *repository.LibraryBookingRepository
}

func NewBookingHandler(repo *repository.LibraryBookingRepository) *BookingHandler {
	return &BookingHandler{Repo: repo}
}

// CreateBooking - Siswa/Guru dapat membuat booking buku
func (h *BookingHandler) CreateBooking(c echo.Context) error {
	var input models.CreateBookingRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data tidak valid"})
	}

	userID := c.Get("userID").(string) // From JWT context
	
	booking, err := h.Repo.CreateBooking(input, userID)
	if err != nil {
		if err.Error() == "buku tidak ditemukan" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat booking"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    booking,
	})
}

// GetMyBookings - Lihat daftar booking sendiri
func (h *BookingHandler) GetMyBookings(c echo.Context) error {
	userID := c.Get("userID").(string)
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	bookings, total, err := h.Repo.GetMyBookings(userID, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	totalPages := (total + perPage - 1) / perPage

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      bookings,
		"totalItems": total,
		"totalPages": totalPages,
		"page":       page,
	})
}

// CancelBooking - Batalkan booking yang masih pending/confirmed
func (h *BookingHandler) CancelBooking(c echo.Context) error {
	id := c.Param("id")
	
	err := h.Repo.CancelBooking(id, nil)
	if err != nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
	})
}
