package repository

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type ParentRepository struct {
	DB *sql.DB
}

func NewParentRepository(db *sql.DB) *ParentRepository {
	return &ParentRepository{DB: db}
}

// LinkParent menautkan akun ortu ke siswa (idempoten).
func (r *ParentRepository) LinkParent(userID, studentID, relation string) error {
	if strings.TrimSpace(relation) == "" {
		relation = "orangtua"
	}
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO parent_students (id, user_id, student_id, relation, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, 1, ?, ?)
		ON CONFLICT(user_id, student_id) DO UPDATE SET relation = excluded.relation, is_active = 1, updated_at = excluded.updated_at
	`, cuid2.Generate(), userID, studentID, relation, now, now)
	return err
}

// UnlinkParent menonaktifkan tautan (soft) agar riwayat tetap ada.
func (r *ParentRepository) UnlinkParent(userID, studentID string) error {
	_, err := r.DB.Exec(`
		UPDATE parent_students SET is_active = 0, updated_at = ? WHERE user_id = ? AND student_id = ?
	`, time.Now().UnixMilli(), userID, studentID)
	return err
}

// IsParentOf memastikan user benar-benar orang tua dari siswa (otorisasi).
func (r *ParentRepository) IsParentOf(userID, studentID string) (bool, error) {
	var n int
	err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM parent_students WHERE user_id = ? AND student_id = ? AND is_active = 1
	`, userID, studentID).Scan(&n)
	return n > 0, err
}

// GetChildrenByUser daftar anak beserta kelas dan saldo tabungan.
func (r *ParentRepository) GetChildrenByUser(userID string) ([]models.ParentChild, error) {
	rows, err := r.DB.Query(`
		SELECT s.id, s.full_name, COALESCE(s.nisn,''), COALESCE(s.class_id,''), COALESCE(s.class_name,''),
		       s.photo, ps.relation, COALESCE(ts.saldo_terakhir, 0)
		FROM parent_students ps
		JOIN students s ON ps.student_id = s.id
		LEFT JOIN tabungan_siswa ts ON ts.student_id = s.id
		WHERE ps.user_id = ? AND ps.is_active = 1
		ORDER BY s.full_name ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.ParentChild, 0)
	for rows.Next() {
		var c models.ParentChild
		var photo sql.NullString
		if err := rows.Scan(&c.StudentID, &c.FullName, &c.NISN, &c.ClassID, &c.ClassName, &photo, &c.Relation, &c.Balance); err != nil {
			return nil, err
		}
		if photo.Valid {
			c.Photo = &photo.String
		}
		list = append(list, c)
	}
	return list, nil
}

// GetRecentAttendance riwayat presensi terbaru siswa (urut tanggal desc).
func (r *ParentRepository) GetRecentAttendance(studentID string, limit int) ([]models.ParentAttendanceRecord, error) {
	if limit < 1 {
		limit = 30
	}
	rows, err := r.DB.Query(`
		SELECT asess.date, ar.status, ar.check_in_time, ar.record_method
		FROM attendance_records ar
		JOIN attendance_sessions asess ON ar.session_id = asess.id
		WHERE ar.student_id = ?
		ORDER BY asess.date DESC
		LIMIT ?
	`, studentID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.ParentAttendanceRecord, 0, limit)
	for rows.Next() {
		var rec models.ParentAttendanceRecord
		var checkIn sql.NullInt64
		if err := rows.Scan(&rec.Date, &rec.Status, &checkIn, &rec.RecordMethod); err != nil {
			return nil, err
		}
		if checkIn.Valid {
			rec.CheckInTime = &checkIn.Int64
		}
		list = append(list, rec)
	}
	return list, nil
}

// GetDailyAttendanceStatus status kehadiran siswa pada tanggal tertentu.
// Mengembalikan "" bila belum tercatat (belum ada sesi kelas atau belum absen).
func (r *ParentRepository) GetDailyAttendanceStatus(studentID, date string) string {
	var status sql.NullString
	_ = r.DB.QueryRow(`
		SELECT ar.status
		FROM attendance_records ar
		JOIN attendance_sessions asess ON ar.session_id = asess.id
		WHERE ar.student_id = ? AND asess.date = ?
		ORDER BY ar.created_at DESC
		LIMIT 1
	`, studentID, date).Scan(&status)
	if !status.Valid {
		return ""
	}
	return status.String
}

// GetWeeklyAttendance rangkuman kehadiran 7 hari terakhir (WIB) untuk siswa.
// Tanggal hari ini dikembalikan pertama.
func (r *ParentRepository) GetWeeklyAttendance(studentID string) ([]models.ParentAttendanceRecord, error) {
	today := TodayJakarta()
	start := ""
	if t, err := time.Parse("2006-01-02", today); err == nil {
		start = t.AddDate(0, 0, -6).Format("2006-01-02")
	}

	rows, err := r.DB.Query(`
		SELECT asess.date, ar.status, ar.check_in_time, ar.record_method
		FROM attendance_records ar
		JOIN attendance_sessions asess ON ar.session_id = asess.id
		WHERE ar.student_id = ? AND asess.date BETWEEN ? AND ?
		ORDER BY asess.date DESC
	`, studentID, start, today)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.ParentAttendanceRecord, 0, 7)
	for rows.Next() {
		var rec models.ParentAttendanceRecord
		var checkIn sql.NullInt64
		if err := rows.Scan(&rec.Date, &rec.Status, &checkIn, &rec.RecordMethod); err != nil {
			return nil, err
		}
		if checkIn.Valid {
			rec.CheckInTime = &checkIn.Int64
		}
		list = append(list, rec)
	}
	return list, nil
}

// ListParentsOfStudent daftar akun ortu yang tertaut ke siswa (admin).
func (r *ParentRepository) ListParentsOfStudent(studentID string) ([]models.ParentAccount, error) {
	rows, err := r.DB.Query(`
		SELECT u.id, COALESCE(u.name,''), COALESCE(u.phone,''), ps.relation
		FROM parent_students ps
		JOIN users u ON ps.user_id = u.id
		WHERE ps.student_id = ? AND ps.is_active = 1
		ORDER BY u.name ASC
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]models.ParentAccount, 0)
	for rows.Next() {
		var a models.ParentAccount
		if err := rows.Scan(&a.UserID, &a.Name, &a.Phone, &a.Relation); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, nil
}

// GetParentUserIDs daftar akun ortu aktif untuk satu siswa (fan-out push).
// Hanya akun ber-role "orangtua" yang aktif: tautan lama ke akun guru/staff
// tidak boleh menerima notifikasi portal ortu (target URL-nya /parent/*).
func (r *ParentRepository) GetParentUserIDs(studentID string) ([]string, error) {
	rows, err := r.DB.Query(`
		SELECT ps.user_id
		FROM parent_students ps
		JOIN users u ON u.id = ps.user_id
		WHERE ps.student_id = ? AND ps.is_active = 1
		  AND u.role = 'orangtua' AND u.is_active = 1
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]string, 0, 2)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// FindStudentForRegistration mencari siswa untuk verifikasi pendaftaran ortu.
func (r *ParentRepository) FindStudentForRegistration(nisn, birthDate string) (studentID, fullName string, err error) {
	err = r.DB.QueryRow(`
		SELECT id, full_name FROM students
		WHERE nisn = ? AND birth_date = ? AND (status = 'active' OR is_active = 1)
		LIMIT 1
	`, strings.TrimSpace(nisn), strings.TrimSpace(birthDate)).Scan(&studentID, &fullName)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", nil
	}
	return studentID, fullName, err
}

// PhoneTaken cek apakah nomor sudah dipakai akun lain (username unik).
func (r *ParentRepository) PhoneTaken(phone string) (bool, error) {
	var n int
	err := r.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE username = ?`, strings.TrimSpace(phone)).Scan(&n)
	return n > 0, err
}

// GetStudentBrief data minimum siswa (nama + kelas) untuk validasi & presensi.
func (r *ParentRepository) GetStudentBrief(studentID string) (fullName, className string, err error) {
	err = r.DB.QueryRow(`SELECT full_name, COALESCE(class_name,'') FROM students WHERE id = ?`, studentID).Scan(&fullName, &className)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", nil
	}
	return fullName, className, err
}

// ============ Izin / Sakit ============

func (r *ParentRepository) CreateLeave(lr models.LeaveRequest) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO leave_requests (id, student_id, parent_user_id, type, start_date, end_date, reason, attachment_path, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
	`, id, lr.StudentID, lr.ParentUserID, lr.Type, lr.StartDate, lr.EndDate, lr.Reason, lr.AttachmentPath, now, now)
	return id, err
}

func (r *ParentRepository) GetLeaveByParent(userID string, limit, offset int) ([]models.LeaveRequest, int, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	var total int
	_ = r.DB.QueryRow(`SELECT COUNT(*) FROM leave_requests WHERE parent_user_id = ?`, userID).Scan(&total)
	list, err := r.scanLeaves(`
		SELECT lr.id, lr.student_id, COALESCE(s.full_name,''), COALESCE(s.class_name,''), lr.parent_user_id,
		       COALESCE(u.name,''), lr.type, lr.start_date, lr.end_date, lr.reason, lr.attachment_path,
		       lr.status, lr.reviewed_by, lr.reviewed_at, lr.review_note, lr.created_at, lr.updated_at
		FROM leave_requests lr
		LEFT JOIN students s ON lr.student_id = s.id
		LEFT JOIN users u ON lr.parent_user_id = u.id
		WHERE lr.parent_user_id = ?
		ORDER BY lr.created_at DESC
		LIMIT ? OFFSET ?
	`, userID, limit, offset)
	return list, total, err
}

func (r *ParentRepository) GetLeaveByID(id string) (*models.LeaveRequest, error) {
	list, err := r.scanLeaves(`
		SELECT lr.id, lr.student_id, COALESCE(s.full_name,''), COALESCE(s.class_name,''), lr.parent_user_id,
		       COALESCE(u.name,''), lr.type, lr.start_date, lr.end_date, lr.reason, lr.attachment_path,
		       lr.status, lr.reviewed_by, lr.reviewed_at, lr.review_note, lr.created_at, lr.updated_at
		FROM leave_requests lr
		LEFT JOIN students s ON lr.student_id = s.id
		LEFT JOIN users u ON lr.parent_user_id = u.id
		WHERE lr.id = ?
	`, id)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return &list[0], nil
}

// ListLeaveRequests untuk guru/admin; statusFilter opsional, classFilter opsional.
func (r *ParentRepository) ListLeaveRequests(statusFilter, className string) ([]models.LeaveRequest, error) {
	query := `
		SELECT lr.id, lr.student_id, COALESCE(s.full_name,''), COALESCE(s.class_name,''), lr.parent_user_id,
		       COALESCE(u.name,''), lr.type, lr.start_date, lr.end_date, lr.reason, lr.attachment_path,
		       lr.status, lr.reviewed_by, lr.reviewed_at, lr.review_note, lr.created_at, lr.updated_at
		FROM leave_requests lr
		LEFT JOIN students s ON lr.student_id = s.id
		LEFT JOIN users u ON lr.parent_user_id = u.id
		WHERE 1=1
	`
	args := []interface{}{}
	if strings.TrimSpace(statusFilter) != "" {
		query += " AND lr.status = ?"
		args = append(args, strings.TrimSpace(statusFilter))
	}
	if strings.TrimSpace(className) != "" {
		query += " AND s.class_name = ?"
		args = append(args, strings.TrimSpace(className))
	}
	query += " ORDER BY lr.created_at DESC LIMIT 200"
	return r.scanLeaves(query, args...)
}

func (r *ParentRepository) UpdateLeaveStatus(id, status, reviewedBy, note string) error {
	_, err := r.DB.Exec(`
		UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ?, updated_at = ? WHERE id = ?
	`, status, reviewedBy, time.Now().UnixMilli(), note, time.Now().UnixMilli(), id)
	return err
}

func (r *ParentRepository) scanLeaves(query string, args ...interface{}) ([]models.LeaveRequest, error) {
	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]models.LeaveRequest, 0)
	for rows.Next() {
		var lr models.LeaveRequest
		var attachment, reviewedBy, reviewNote sql.NullString
		var reviewedAt sql.NullInt64
		var ca, ua int64
		if err := rows.Scan(
			&lr.ID, &lr.StudentID, &lr.StudentName, &lr.ClassName, &lr.ParentUserID, &lr.ParentName,
			&lr.Type, &lr.StartDate, &lr.EndDate, &lr.Reason, &attachment, &lr.Status,
			&reviewedBy, &reviewedAt, &reviewNote, &ca, &ua,
		); err != nil {
			return nil, err
		}
		if attachment.Valid {
			lr.AttachmentPath = &attachment.String
		}
		if reviewedBy.Valid {
			lr.ReviewedBy = &reviewedBy.String
		}
		if reviewNote.Valid {
			lr.ReviewNote = &reviewNote.String
		}
		if reviewedAt.Valid {
			t := time.UnixMilli(reviewedAt.Int64)
			lr.ReviewedAt = &t
		}
		lr.CreatedAt = time.UnixMilli(ca)
		lr.UpdatedAt = time.UnixMilli(ua)
		list = append(list, lr)
	}
	return list, nil
}

// GetPendingLeaveCounts jumlah pengajuan izin/sakit berstatus menunggu,
// dikelompokkan per student_id milik orang tua tersebut.
func (r *ParentRepository) GetPendingLeaveCounts(userID string) (map[string]int, error) {
	rows, err := r.DB.Query(`
		SELECT student_id, COUNT(*)
		FROM leave_requests
		WHERE parent_user_id = ? AND status = 'pending'
		GROUP BY student_id
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var studentID string
		var count int
		if err := rows.Scan(&studentID, &count); err != nil {
			return nil, err
		}
		counts[studentID] = count
	}
	return counts, nil
}

// GetLatestVerifiedTransaction transaksi tabungan tersimpan terakhir milik siswa.
func (r *ParentRepository) GetLatestVerifiedTransaction(studentID string) (*models.ParentDashboardTransaction, error) {
	var tx models.ParentDashboardTransaction
	var catatan sql.NullString
	err := r.DB.QueryRow(`
		SELECT tipe, nominal, catatan, created_at
		FROM tabungan_transaksi
		WHERE siswa_id = ? AND status = 'verified'
		ORDER BY created_at DESC
		LIMIT 1
	`, studentID).Scan(&tx.Tipe, &tx.Nominal, &catatan, &tx.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if catatan.Valid {
		tx.Catatan = catatan.String
	}
	return &tx, nil
}
