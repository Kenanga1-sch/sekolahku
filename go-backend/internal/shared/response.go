package shared

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

// SuccessResponse returns a standard success JSON response.
func SuccessResponse(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    data,
	})
}

// SuccessListResponse returns a standard paginated list response.
func SuccessListResponse(c echo.Context, data interface{}, total, page, limit int) error {
	totalPages := (total + limit - 1) / limit
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"data":       data,
		"items":      data,
		"totalItems": total,
		"totalPages": totalPages,
		"pagination": map[string]interface{}{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": totalPages,
		},
	})
}

// ErrorResponse returns a standard error JSON response.
func ErrorResponse(c echo.Context, status int, message string) error {
	return c.JSON(status, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}

// InternalError is a shorthand for 500 errors.
func InternalError(c echo.Context) error {
	return c.JSON(http.StatusInternalServerError, map[string]interface{}{
		"success": false,
		"error":   "Terjadi kesalahan internal",
	})
}

// BadRequest is a shorthand for 400 errors.
func BadRequest(c echo.Context, message string) error {
	return c.JSON(http.StatusBadRequest, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}

// NotFound is a shorthand for 404 errors.
func NotFound(c echo.Context, message string) error {
	if message == "" {
		message = "Data tidak ditemukan"
	}
	return c.JSON(http.StatusNotFound, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}

// ParsePagination extracts page and limit from query params with defaults.
func ParsePagination(c echo.Context) (page, limit int) {
	page, _ = strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ = strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit, _ = strconv.Atoi(c.QueryParam("perPage"))
	}
	if limit < 1 {
		limit = 20
	}
	return
}