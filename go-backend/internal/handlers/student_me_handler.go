package handlers

import (
	"database/sql"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

// StudentMeHandler menyediakan endpoint self-service untuk siswa.
// Semua endpoint di-scoping hanya pada siswa pemilik JWT.
type StudentMeHandler struct {
	Students    *repository.StudentRepository
	Attendance  *repository.AttendanceRepository
	Savings     *repository.SavingsRepository
	Announcements *repository.AnnouncementRepository
	DB          *sql.DB
}

func NewStudentMeHandler(
	students *repository.StudentRepository,
	attendance *repository.AttendanceRepository,
	savings *repository.SavingsRepository,
	announcements *repository.AnnouncementRepository,
	db *sql.DB,
) *StudentMeHandler {
	return &StudentMeHandler{
		Students:      students,
		Attendance:    attendance,
		Savings:       savings,
		Announcements: announcements,
		DB:            db,
	}
}

// resolveStudentID mengambil student_id dari user yang login.
func (h *StudentMeHandler) resolveStudentID(c echo.Context) (string, error) {
	userID, _ := c.Get("user_id").(string)
	var studentID string
	err := h.DB.QueryRow(
		"SELECT COALESCE(student_id, '') FROM users WHERE id = ?", userID,
	).Scan(&studentID)
	if err != nil {
		return "", err
	}
	if studentID == "" {
		return "", sql.ErrNoRows
	}
	return studentID, nil
}

// GetMe mengembalikan profil siswa pemilik token.
func (h *StudentMeHandler) GetMe(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Akun tidak terhubung ke data siswa",
		})
	}

	student, err := h.Students.GetStudentByID(studentID)
	if err != nil || student == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Data siswa tidak ditemukan",
		})
	}

	// Ambil info tabungan.
	var saldo int
	_ = h.DB.QueryRow(
		"SELECT COALESCE(saldo_terakhir, 0) FROM tabungan_siswa WHERE student_id = ?",
		studentID,
	).Scan(&saldo)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"id":        student.ID,
			"fullName":  student.FullName,
			"nisn":      student.NISN,
			"nis":       student.NIS,
			"classId":   student.ClassID,
			"className": student.ClassName,
			"photo":     student.Photo,
			"balance":   saldo,
		},
	})
}

// GetMyAttendance mengembalikan ringkasan presensi siswa per tahun ajaran.
func (h *StudentMeHandler) GetMyAttendance(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Akun tidak terhubung ke data siswa",
		})
	}

	summary, err := h.Attendance.GetStudentAttendanceSummary(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Terjadi kesalahan internal",
		})
	}

	// Hitung total dari semua tahun ajaran.
	type statusCount struct {
		Status string `json:"status"`
		Count  int    `json:"count"`
	}
	totals := map[string]int{"hadir": 0, "sakit": 0, "izin": 0, "alpha": 0}
	for _, s := range summary {
		totals["hadir"] += s.Hadir
		totals["sakit"] += s.Sakit
		totals["izin"] += s.Izin
		totals["alpha"] += s.Alpha
	}
	var result []statusCount
	for _, st := range []string{"hadir", "sakit", "izin", "alpha"} {
		result = append(result, statusCount{Status: st, Count: totals[st]})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetMySavings mengembalikan saldo + 10 transaksi terakhir siswa.
func (h *StudentMeHandler) GetMySavings(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Akun tidak terhubung ke data siswa",
		})
	}

	// Saldo.
	var saldo int
	_ = h.DB.QueryRow(
		"SELECT COALESCE(saldo_terakhir, 0) FROM tabungan_siswa WHERE student_id = ?",
		studentID,
	).Scan(&saldo)

	// 10 transaksi terakhir.
	rows, err := h.DB.Query(`
		SELECT id, tipe, nominal, keterangan, created_at
		FROM tabungan_transaksi
		WHERE student_id = ?
		ORDER BY created_at DESC
		LIMIT 10
	`, studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Terjadi kesalahan internal",
		})
	}
	defer rows.Close()

	type txn struct {
		ID        string `json:"id"`
		Tipe      string `json:"tipe"`
		Nominal   int    `json:"nominal"`
		Keterangan string `json:"keterangan"`
		CreatedAt int64  `json:"createdAt"`
	}
	var transaksi []txn
	for rows.Next() {
		var t txn
		if err := rows.Scan(&t.ID, &t.Tipe, &t.Nominal, &t.Keterangan, &t.CreatedAt); err == nil {
			transaksi = append(transaksi, t)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"balance":    saldo,
			"transaksi":  transaksi,
		},
	})
}
