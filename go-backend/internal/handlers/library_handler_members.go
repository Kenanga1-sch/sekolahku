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

// ============ Members CRUD ============

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

	if search != "" {
		var studentID string
		var isActive int
		var status string
		err := h.Repo.DB.QueryRow(`
			SELECT id, is_active, COALESCE(status, '') 
			FROM students 
			WHERE (id = ? OR nisn = ? OR qr_code = ?)
			  AND id NOT IN (SELECT student_id FROM library_members WHERE student_id IS NOT NULL)
		`, search, search, search).Scan(&studentID, &isActive, &status)
		if err == nil && (isActive == 1 || status == "active" || status == "aktif") {
			_ = repository.AutoSyncStudentToSavingsAndLibrary(h.Repo.DB, studentID)
		}
	}

	items, total, err := h.Repo.GetMembers(page, perPage, search)
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

func (h *LibraryHandler) CreateMember(c echo.Context) error {
	var m models.LibraryMember
	if err := c.Bind(&m); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.CreateMember(m); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) UpdateMember(c echo.Context) error {
	id := c.Param("id")
	var input models.UpdateMemberRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.UpdateMember(id, input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) DeleteMember(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteMember(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) SyncLibrary(c echo.Context) error {
	count, err := h.Repo.SyncFromStudents()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": strconv.Itoa(count) + " anggota berhasil disinkronisasi",
	})
}

func (h *LibraryHandler) GetMemberByQRCode(c echo.Context) error {
	code := c.Param("code")
	member, err := h.Repo.GetMemberByCode(code)
	if errors.Is(err, sql.ErrNoRows) {
		var studentID string
		var isActive int
		var status string
		err = h.Repo.DB.QueryRow(`
			SELECT id, is_active, COALESCE(status, '') 
			FROM students 
			WHERE id = ? OR nisn = ? OR qr_code = ?
		`, code, code, code).Scan(&studentID, &isActive, &status)
		if err == nil && (isActive == 1 || status == "active" || status == "aktif") {
			_ = repository.AutoSyncStudentToSavingsAndLibrary(h.Repo.DB, studentID)
			member, err = h.Repo.GetMemberByCode(code)
		}
	}
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Anggota tidak ditemukan"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, member)
}
