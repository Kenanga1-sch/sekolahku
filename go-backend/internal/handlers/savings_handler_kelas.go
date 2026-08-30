package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// ============ Kelas (proxied to student_classes — single source) ============

// savingsKelasItem matches the old TabunganKelas API shape
type savingsKelasItem struct {
	ID        string  `json:"id"`
	Nama      string  `json:"nama"`
	WaliKelas *string `json:"waliKelas"`
}

// GetClassesWithReps lists classes from student_classes (source of truth)
func (h *SavingsHandler) GetClassesWithReps(c echo.Context) error {
	rows, err := h.Repo.DB.Query(`
		SELECT k.id, k.name, NULL
		FROM student_classes k
		WHERE k.is_active = 1
		ORDER BY k.name ASC
	`)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	defer rows.Close()

	list := make([]savingsKelasItem, 0)
	for rows.Next() {
		var k savingsKelasItem
		var wali sql.NullString
		if err := rows.Scan(&k.ID, &k.Nama, &wali); err != nil {
			continue
		}
		list = append(list, k)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list})
}

// AssignClassRep: class coordination now lives on student_classes.teacher_name
func (h *SavingsHandler) AssignClassRep(c echo.Context) error {
	classId := c.Param("id")
	var req struct {
		UserID string `json:"userId"`
	}
	c.Bind(&req)
	if strings.TrimSpace(req.UserID) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "userId wajib diisi"})
	}
	// Resolve user display name, store as teacher_name (single source column)
	var userName sql.NullString
	_ = h.Repo.DB.QueryRow("SELECT COALESCE(name, username) FROM users WHERE id = ?", req.UserID).Scan(&userName)
	if !userName.Valid || userName.String == "" {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "User tidak ditemukan"})
	}
	if _, err := h.Repo.DB.Exec(
		"UPDATE student_classes SET teacher_name = ?, updated_at = ? WHERE id = ?",
		userName.String, time.Now().UnixMilli(), classId); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "PJ Kelas berhasil diupdate"})
}

func (h *SavingsHandler) UpdateClassRep(c echo.Context) error {
	return h.AssignClassRep(c)
}

// Create/Update/Delete class now belong to the Academic module; savings no longer duplicates them.
func (h *SavingsHandler) CreateKelas(c echo.Context) error {
	return c.JSON(http.StatusGone, map[string]interface{}{
		"success": false,
		"error":   "Kelas kini dikelola di modul Akademik (single source). Gunakan /api/academic/classes.",
	})
}

func (h *SavingsHandler) UpdateKelas(c echo.Context) error {
	return c.JSON(http.StatusGone, map[string]interface{}{
		"success": false,
		"error":   "Kelas kini dikelola di modul Akademik (single source). Gunakan /api/academic/classes.",
	})
}

func (h *SavingsHandler) DeleteKelas(c echo.Context) error {
	return c.JSON(http.StatusGone, map[string]interface{}{
		"success": false,
		"error":   "Kelas kini dikelola di modul Akademik (single source). Gunakan /api/academic/classes.",
	})
}
