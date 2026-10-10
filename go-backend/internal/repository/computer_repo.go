package repository

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// ComputerRepository menangani modul "Komputer Belajar" perpustakaan:
// stasiun komputer, kuota menit per kelas/siswa, laporan baca, booking, dan
// sesi pemakaian ber-timer.
type ComputerRepository struct {
	DB *sql.DB
}

func NewComputerRepository(db *sql.DB) *ComputerRepository {
	return &ComputerRepository{DB: db}
}

// ---------- Stasiun ----------

func (r *ComputerRepository) ListStations() ([]models.ComputerStation, error) {
	rows, err := r.DB.Query(`
		SELECT id, code, name, COALESCE(location,''), sort_order, status,
		       COALESCE(last_seen_at,0), COALESCE(created_at,0), COALESCE(updated_at,0)
		FROM computer_stations
		ORDER BY sort_order, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.ComputerStation{}
	for rows.Next() {
		var s models.ComputerStation
		var ls, ca, ua sql.NullInt64
		if err := rows.Scan(&s.ID, &s.Code, &s.Name, &s.Location, &s.SortOrder, &s.Status, &ls, &ca, &ua); err != nil {
			continue
		}
		s.LastSeenAt = msToTime(ls)
		s.CreatedAt = msToTime(ca)
		s.UpdatedAt = msToTime(ua)
		out = append(out, s)
	}
	return out, nil
}

func (r *ComputerRepository) GetStationByCode(code string) (*models.ComputerStation, error) {
	var s models.ComputerStation
	var ls, ca, ua sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT id, code, name, COALESCE(location,''), sort_order, status,
		       COALESCE(last_seen_at,0), COALESCE(created_at,0), COALESCE(updated_at,0)
		FROM computer_stations WHERE code = ?
	`, code).Scan(&s.ID, &s.Code, &s.Name, &s.Location, &s.SortOrder, &s.Status, &ls, &ca, &ua)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	s.LastSeenAt = msToTime(ls)
	s.CreatedAt = msToTime(ca)
	s.UpdatedAt = msToTime(ua)
	return &s, nil
}

func (r *ComputerRepository) CreateStation(req models.CreateComputerStationRequest) (*models.ComputerStation, error) {
	code := strings.TrimSpace(req.Code)
	name := strings.TrimSpace(req.Name)
	if code == "" || name == "" {
		return nil, errors.New("kode dan nama stasiun wajib diisi")
	}
	status := req.Status
	if status == "" {
		status = "active"
	}
	now := UnixMilli()
	id := cuid2.Generate()
	_, err := r.DB.Exec(`
		INSERT INTO computer_stations (id, code, name, location, sort_order, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, code, name, strings.TrimSpace(req.Location), req.SortOrder, status, now, now)
	if err != nil {
		return nil, err
	}
	return r.GetStationByCode(code)
}

func (r *ComputerRepository) UpdateStation(id string, req models.CreateComputerStationRequest) error {
	status := req.Status
	if status == "" {
		status = "active"
	}
	_, err := r.DB.Exec(`
		UPDATE computer_stations
		SET code = ?, name = ?, location = ?, sort_order = ?, status = ?, updated_at = ?
		WHERE id = ?
	`, strings.TrimSpace(req.Code), strings.TrimSpace(req.Name), strings.TrimSpace(req.Location), req.SortOrder, status, UnixMilli(), id)
	return err
}

func (r *ComputerRepository) DeleteStation(id string) error {
	_, err := r.DB.Exec(`DELETE FROM computer_stations WHERE id = ?`, id)
	return err
}

func (r *ComputerRepository) TouchStation(stationID string) {
	_, _ = r.DB.Exec(`UPDATE computer_stations SET last_seen_at = ? WHERE id = ?`, UnixMilli(), stationID)
}

// ---------- Kuota menit ----------

// ListQuotaPolicies mengembalikan jatah menit per kelas (termasuk default "").
func (r *ComputerRepository) ListQuotaPolicies() ([]models.ComputerQuotaPolicy, error) {
	rows, err := r.DB.Query(`
		SELECT class_name, minutes, COALESCE(updated_at,0)
		FROM computer_quota_policies ORDER BY class_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.ComputerQuotaPolicy{}
	for rows.Next() {
		var p models.ComputerQuotaPolicy
		var ua sql.NullInt64
		if err := rows.Scan(&p.ClassName, &p.Minutes, &ua); err != nil {
			continue
		}
		p.UpdatedAt = msToTime(ua)
		out = append(out, p)
	}
	return out, nil
}

func (r *ComputerRepository) SetQuotaPolicy(m models.ComputerQuotaPolicy) error {
	if m.Minutes < 0 {
		m.Minutes = 0
	}
	_, err := r.DB.Exec(`
		INSERT INTO computer_quota_policies (class_name, minutes, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(class_name) DO UPDATE SET minutes = excluded.minutes, updated_at = excluded.updated_at
	`, strings.TrimSpace(m.ClassName), m.Minutes, UnixMilli())
	return err
}

// QuotaMinutesForClass: menit jatah untuk sebuah kelas. Prioritas: policy
// kelas persis, lalu policy default (""), lalu 0.
func (r *ComputerRepository) QuotaMinutesForClass(className string) int {
	className = strings.TrimSpace(className)
	var m int
	if className != "" {
		if err := r.DB.QueryRow(`SELECT minutes FROM computer_quota_policies WHERE class_name = ?`, className).Scan(&m); err == nil {
			return m
		}
	}
	if err := r.DB.QueryRow(`SELECT minutes FROM computer_quota_policies WHERE class_name = ''`).Scan(&m); err == nil {
		return m
	}
	return 0
}

// GetQuota mengembalikan kuota menit seorang siswa. Bila belum ada baris,
// otomatis diberi jatah sesuai policy kelasnya (bila policy > 0).
func (r *ComputerRepository) GetQuota(studentID string) (*models.ComputerTimeQuota, error) {
	var q models.ComputerTimeQuota
	var ua sql.NullInt64
	q.StudentID = studentID
	err := r.DB.QueryRow(`
		SELECT COALESCE(total_minutes,0), COALESCE(used_minutes,0), COALESCE(updated_at,0)
		FROM computer_time_quotas WHERE student_id = ?
	`, studentID).Scan(&q.TotalMinutes, &q.UsedMinutes, &ua)
	if err == nil {
		q.UpdatedAt = msToTime(ua)
		q.Remaining = q.TotalMinutes - q.UsedMinutes
		if q.Remaining < 0 {
			q.Remaining = 0
		}
		return &q, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	// Belum ada: beri jatah default sesuai kelas.
	var className string
	_ = r.DB.QueryRow(`SELECT COALESCE(class_name,'') FROM students WHERE id = ?`, studentID).Scan(&className)
	minutes := r.QuotaMinutesForClass(className)
	if minutes > 0 {
		_, err = r.DB.Exec(`
			INSERT INTO computer_time_quotas (student_id, total_minutes, used_minutes, updated_at)
			VALUES (?, ?, 0, ?)
			ON CONFLICT(student_id) DO NOTHING
		`, studentID, minutes, UnixMilli())
		if err != nil {
			return nil, err
		}
		return r.GetQuota(studentID)
	}
	q.Remaining = 0
	return &q, nil
}

// SetStudentQuota menetapkan total jatah menit seorang siswa (admin).
func (r *ComputerRepository) SetStudentQuota(studentID string, totalMinutes int) error {
	if totalMinutes < 0 {
		totalMinutes = 0
	}
	_, err := r.DB.Exec(`
		INSERT INTO computer_time_quotas (student_id, total_minutes, used_minutes, updated_at)
		VALUES (?, ?, 0, ?)
		ON CONFLICT(student_id) DO UPDATE SET total_minutes = excluded.total_minutes, updated_at = excluded.updated_at
	`, studentID, totalMinutes, UnixMilli())
	return err
}

// ConsumeQuota menambah used_minutes. Nilai minus = mengembalikan (refund).
func (r *ComputerRepository) ConsumeQuota(studentID string, minutes int) error {
	if minutes == 0 {
		return nil
	}
	_, err := r.DB.Exec(`
		UPDATE computer_time_quotas
		SET used_minutes = MAX(0, used_minutes + ?), updated_at = ?
		WHERE student_id = ?
	`, minutes, UnixMilli(), studentID)
	return err
}

// ListQuotas menampilkan kuota siswa (dengan filter kelas opsional).
func (r *ComputerRepository) ListQuotas(className string, limit int) ([]models.ComputerTimeQuota, error) {
	if limit < 1 || limit > 500 {
		limit = 200
	}
	args := []interface{}{}
	where := ""
	if strings.TrimSpace(className) != "" {
		where = "WHERE COALESCE(s.class_name,'') = ?"
		args = append(args, strings.TrimSpace(className))
	}
	args = append(args, limit)
	rows, err := r.DB.Query(`
		SELECT q.student_id, COALESCE(s.full_name,''), COALESCE(s.class_name,''),
		       COALESCE(q.total_minutes,0), COALESCE(q.used_minutes,0), COALESCE(q.updated_at,0)
		FROM computer_time_quotas q
		LEFT JOIN students s ON s.id = q.student_id
		`+where+`
		ORDER BY s.class_name, s.full_name
		LIMIT ?
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.ComputerTimeQuota{}
	for rows.Next() {
		var q models.ComputerTimeQuota
		var ua sql.NullInt64
		if err := rows.Scan(&q.StudentID, &q.StudentName, &q.ClassName, &q.TotalMinutes, &q.UsedMinutes, &ua); err != nil {
			continue
		}
		q.UpdatedAt = msToTime(ua)
		q.Remaining = q.TotalMinutes - q.UsedMinutes
		if q.Remaining < 0 {
			q.Remaining = 0
		}
		out = append(out, q)
	}
	return out, nil
}

// ---------- Laporan baca ----------

func (r *ComputerRepository) CreateReadingReport(studentID string, req models.CreateReadingReportRequest) (*models.ReadingReport, error) {
	if strings.TrimSpace(req.Summary) == "" || strings.TrimSpace(req.Conclusion) == "" || strings.TrimSpace(req.Question) == "" {
		return nil, errors.New("ringkasan, kesimpulan, dan pertanyaan wajib diisi")
	}
	var name, class string
	_ = r.DB.QueryRow(`SELECT full_name, COALESCE(class_name,'') FROM students WHERE id = ?`, studentID).Scan(&name, &class)

	id := cuid2.Generate()
	now := UnixMilli()
	var catalogID interface{}
	if strings.TrimSpace(req.CatalogID) != "" {
		catalogID = req.CatalogID
	}
	_, err := r.DB.Exec(`
		INSERT INTO reading_reports (
			id, student_id, student_name, class_name, catalog_id, book_title, book_author,
			summary, conclusion, question, status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
	`, id, studentID, name, class, catalogID,
		strings.TrimSpace(req.BookTitle), strings.TrimSpace(req.BookAuthor),
		strings.TrimSpace(req.Summary), strings.TrimSpace(req.Conclusion), strings.TrimSpace(req.Question),
		now, now)
	if err != nil {
		return nil, err
	}
	return r.GetReadingReport(id)
}

func (r *ComputerRepository) GetReadingReport(id string) (*models.ReadingReport, error) {
	var (
		m          models.ReadingReport
		catalogID  sql.NullString
		reviewedBy sql.NullString
		reviewedAt sql.NullInt64
		ca, ua     sql.NullInt64
	)
	err := r.DB.QueryRow(`
		SELECT id, student_id, student_name, class_name, catalog_id, book_title, book_author,
		       summary, conclusion, question, status, COALESCE(review_notes,''),
		       reviewed_by, reviewed_at, COALESCE(created_at,0), COALESCE(updated_at,0)
		FROM reading_reports WHERE id = ?
	`, id).Scan(&m.ID, &m.StudentID, &m.StudentName, &m.ClassName, &catalogID, &m.BookTitle, &m.BookAuthor,
		&m.Summary, &m.Conclusion, &m.Question, &m.Status, &m.ReviewNotes,
		&reviewedBy, &reviewedAt, &ca, &ua)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if catalogID.Valid {
		m.CatalogID = &catalogID.String
	}
	if reviewedBy.Valid {
		m.ReviewedBy = &reviewedBy.String
	}
	if reviewedAt.Valid && reviewedAt.Int64 > 0 {
		t := time.UnixMilli(reviewedAt.Int64)
		m.ReviewedAt = &t
	}
	m.CreatedAt = msToTime(ca)
	m.UpdatedAt = msToTime(ua)
	return &m, nil
}

// ListReadingReports: filter opsional status ("pending"/"approved"/"rejected").
func (r *ComputerRepository) ListReadingReports(status, className string, limit int) ([]models.ReadingReport, error) {
	if limit < 1 || limit > 500 {
		limit = 200
	}
	where := []string{"1=1"}
	args := []interface{}{}
	if s := strings.TrimSpace(status); s != "" {
		where = append(where, "status = ?")
		args = append(args, s)
	}
	if c := strings.TrimSpace(className); c != "" {
		where = append(where, "class_name = ?")
		args = append(args, c)
	}
	args = append(args, limit)
	rows, err := r.DB.Query(`
		SELECT id, student_id, student_name, class_name, catalog_id, book_title, book_author,
		       summary, conclusion, question, status, COALESCE(review_notes,''),
		       reviewed_by, reviewed_at, COALESCE(created_at,0), COALESCE(updated_at,0)
		FROM reading_reports
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
		LIMIT ?
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanReadingReports(rows)
}

func (r *ComputerRepository) ListStudentReports(studentID string) ([]models.ReadingReport, error) {
	rows, err := r.DB.Query(`
		SELECT id, student_id, student_name, class_name, catalog_id, book_title, book_author,
		       summary, conclusion, question, status, COALESCE(review_notes,''),
		       reviewed_by, reviewed_at, COALESCE(created_at,0), COALESCE(updated_at,0)
		FROM reading_reports WHERE student_id = ?
		ORDER BY created_at DESC LIMIT 100
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanReadingReports(rows)
}

func (r *ComputerRepository) ReviewReadingReport(id, reviewerID string, approve bool, notes string) error {
	status := "rejected"
	if approve {
		status = "approved"
	}
	res, err := r.DB.Exec(`
		UPDATE reading_reports
		SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
		WHERE id = ? AND status = 'pending'
	`, status, strings.TrimSpace(notes), reviewerID, UnixMilli(), UnixMilli(), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errors.New("laporan tidak ditemukan atau sudah diverifikasi")
	}
	return nil
}

// ---------- Booking ----------

func (r *ComputerRepository) CreateBooking(req models.CreateComputerBookingRequest, createdBy string) (*models.ComputerBooking, error) {
	station, err := r.stationByID(req.StationID)
	if err != nil {
		return nil, err
	}
	if station == nil {
		return nil, errors.New("komputer tidak ditemukan")
	}
	if station.Status != "active" {
		return nil, errors.New("komputer sedang tidak aktif")
	}

	var name, class string
	err = r.DB.QueryRow(`SELECT full_name, COALESCE(class_name,'') FROM students WHERE id = ?`, req.StudentID).Scan(&name, &class)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("siswa tidak ditemukan")
		}
		return nil, err
	}

	start, err := parseTimeFlexible(req.SlotStart)
	if err != nil {
		return nil, errors.New("waktu mulai tidak valid")
	}
	minutes := req.PlannedMinutes
	if minutes <= 0 {
		minutes = 30
	}
	end := start.Add(time.Duration(minutes) * time.Minute)

	// Cegah tumpang-tindih slot pada stasiun yang sama.
	var overlap int
	err = r.DB.QueryRow(`
		SELECT COUNT(*) FROM computer_bookings
		WHERE station_id = ? AND status IN ('booked','active')
		  AND slot_start < ? AND slot_end > ?
	`, station.ID, end.UnixMilli(), start.UnixMilli()).Scan(&overlap)
	if err != nil {
		return nil, err
	}
	if overlap > 0 {
		return nil, errors.New("slot waktu bertabrakan dengan booking lain di komputer ini")
	}

	id := cuid2.Generate()
	now := UnixMilli()
	var reportID, createdByPtr interface{}
	if strings.TrimSpace(req.ReportID) != "" {
		reportID = req.ReportID
	}
	if createdBy != "" {
		createdByPtr = createdBy
	}
	_, err = r.DB.Exec(`
		INSERT INTO computer_bookings (
			id, station_id, student_id, student_name, class_name, report_id,
			slot_start, slot_end, planned_minutes, status, notes, created_by, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked', ?, ?, ?, ?)
	`, id, station.ID, req.StudentID, name, class, reportID,
		start.UnixMilli(), end.UnixMilli(), minutes, strings.TrimSpace(req.Notes), createdByPtr, now, now)
	if err != nil {
		return nil, err
	}
	return r.GetBooking(id)
}

func (r *ComputerRepository) GetBooking(id string) (*models.ComputerBooking, error) {
	b, err := r.scanBooking(r.DB.QueryRow(bookingSelect+` WHERE b.id = ?`, id))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return b, nil
}

// ListBookings mengembalikan booking pada rentang hari (epoch ms). Zero =
// tanpa batas. Filter opsional by student/station.
func (r *ComputerRepository) ListBookings(fromMs, toMs int64, studentID, stationID, status string) ([]models.ComputerBooking, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	if fromMs > 0 {
		where = append(where, "b.slot_end >= ?")
		args = append(args, fromMs)
	}
	if toMs > 0 {
		where = append(where, "b.slot_start <= ?")
		args = append(args, toMs)
	}
	if strings.TrimSpace(studentID) != "" {
		where = append(where, "b.student_id = ?")
		args = append(args, studentID)
	}
	if strings.TrimSpace(stationID) != "" {
		where = append(where, "b.station_id = ?")
		args = append(args, stationID)
	}
	if strings.TrimSpace(status) != "" {
		where = append(where, "b.status = ?")
		args = append(args, status)
	}
	rows, err := r.DB.Query(bookingSelect+` WHERE `+strings.Join(where, " AND ")+` ORDER BY b.slot_start DESC LIMIT 500`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.ComputerBooking{}
	for rows.Next() {
		b, err := r.scanBooking(rows)
		if err != nil {
			continue
		}
		out = append(out, *b)
	}
	return out, nil
}

func (r *ComputerRepository) CancelBooking(id string) error {
	res, err := r.DB.Exec(`
		UPDATE computer_bookings SET status = 'cancelled', updated_at = ?
		WHERE id = ? AND status IN ('booked','active')
	`, UnixMilli(), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errors.New("booking tidak dapat dibatalkan")
	}
	return nil
}

// ---------- Sesi ----------

// StartSession memulai sesi untuk seorang siswa di stasiun tertentu.
// Kuota diperiksa di sini; deadline = sekarang + min(kuota sisa, diminta).
// Bila bookingID diberikan, durasi ideal dari booking dipertimbangkan.
func (r *ComputerRepository) StartSession(stationID, studentID string, booking *models.ComputerBooking) (*models.ComputerSession, error) {
	// Pastikan tidak ada sesi aktif untuk siswa/stasiun ini.
	var active int
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM computer_sessions WHERE ended_at = 0 AND (student_id = ? OR station_id = ?)`, studentID, stationID).Scan(&active); err != nil {
		return nil, err
	}
	if active > 0 {
		return nil, errors.New("masih ada sesi aktif untuk siswa atau komputer ini")
	}

	quota, err := r.GetQuota(studentID)
	if err != nil {
		return nil, err
	}
	if quota.Remaining <= 0 {
		return nil, errors.New("kuota waktu habis")
	}

	minutes := quota.Remaining
	if booking != nil && booking.PlannedMinutes > 0 && booking.PlannedMinutes < minutes {
		minutes = booking.PlannedMinutes
	}
	if minutes <= 0 {
		return nil, errors.New("kuota waktu habis")
	}

	var name string
	_ = r.DB.QueryRow(`SELECT full_name FROM students WHERE id = ?`, studentID).Scan(&name)

	now := time.Now()
	id := cuid2.Generate()
	var bookingID interface{}
	if booking != nil {
		bookingID = booking.ID
	}
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`
		INSERT INTO computer_sessions (
			id, booking_id, station_id, student_id, student_name,
			started_at, deadline_at, ended_at, minutes_used, end_reason, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, '', ?, ?)
	`, id, bookingID, stationID, studentID, name,
		now.UnixMilli(), now.Add(time.Duration(minutes)*time.Minute).UnixMilli(),
		now.UnixMilli(), now.UnixMilli()); err != nil {
		return nil, err
	}
	if booking != nil {
		if _, err := tx.Exec(`UPDATE computer_bookings SET status = 'active', updated_at = ? WHERE id = ?`, UnixMilli(), booking.ID); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetSession(id)
}

func (r *ComputerRepository) GetSession(id string) (*models.ComputerSession, error) {
	s, err := r.scanSession(r.DB.QueryRow(sessionSelect+` WHERE s.id = ?`, id))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return s, nil
}

// GetActiveSessionByStation: sesi yang belum berakhir di sebuah stasiun.
func (r *ComputerRepository) GetActiveSessionByStation(stationID string) (*models.ComputerSession, error) {
	s, err := r.scanSession(r.DB.QueryRow(sessionSelect+` WHERE s.station_id = ? AND s.ended_at = 0 ORDER BY s.started_at DESC LIMIT 1`, stationID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return s, nil
}

// EndSession menutup sesi, menghitung menit terpakai, potong kuota, dan
// mengembalikan sisa waktu ke kuota (refund) bila berakhir lebih cepat dari
// deadline karena alasan non-time_up.
func (r *ComputerRepository) EndSession(id, reason string) (*models.ComputerSession, error) {
	s, err := r.GetSession(id)
	if err != nil {
		return nil, err
	}
	if s == nil {
		return nil, errors.New("sesi tidak ditemukan")
	}
	if s.EndedAt != nil {
		return s, nil // sudah berakhir
	}
	now := time.Now()
	used := int(now.Sub(s.StartedAt).Minutes())
	if used < 0 {
		used = 0
	}
	remaining := s.RemainingMinutes(now)

	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`
		UPDATE computer_sessions SET ended_at = ?, minutes_used = ?, end_reason = ?, updated_at = ?
		WHERE id = ? AND ended_at = 0
	`, now.UnixMilli(), used, reason, UnixMilli(), id); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(`
		UPDATE computer_time_quotas SET used_minutes = MAX(0, used_minutes + ?), updated_at = ?
		WHERE student_id = ?
	`, used, UnixMilli(), s.StudentID); err != nil {
		return nil, err
	}
	// Refund sisa menit bila diputus manual (bukan karena waktu habis).
	if reason != "time_up" && remaining > 0 {
		if _, err := tx.Exec(`
			UPDATE computer_time_quotas SET used_minutes = MAX(0, used_minutes - ?), updated_at = ?
			WHERE student_id = ?
		`, remaining, UnixMilli(), s.StudentID); err != nil {
			return nil, err
		}
	}
	if s.BookingID != nil {
		if _, err := tx.Exec(`UPDATE computer_bookings SET status = 'completed', updated_at = ? WHERE id = ?`, UnixMilli(), *s.BookingID); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetSession(id)
}

// ListSessions: riwayat sesi dengan rentang waktu & filter opsional.
func (r *ComputerRepository) ListSessions(fromMs, toMs int64, studentID, stationID string) ([]models.ComputerSession, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	if fromMs > 0 {
		where = append(where, "s.started_at >= ?")
		args = append(args, fromMs)
	}
	if toMs > 0 {
		where = append(where, "s.started_at <= ?")
		args = append(args, toMs)
	}
	if strings.TrimSpace(studentID) != "" {
		where = append(where, "s.student_id = ?")
		args = append(args, studentID)
	}
	if strings.TrimSpace(stationID) != "" {
		where = append(where, "s.station_id = ?")
		args = append(args, stationID)
	}
	rows, err := r.DB.Query(sessionSelect+` WHERE `+strings.Join(where, " AND ")+` ORDER BY s.started_at DESC LIMIT 500`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.ComputerSession{}
	for rows.Next() {
		s, err := r.scanSession(rows)
		if err != nil {
			continue
		}
		out = append(out, *s)
	}
	return out, nil
}

// ---------- Scheduler helpers ----------

// DueSessions mengembalikan ID sesi aktif yang sudah melewati deadline.
func (r *ComputerRepository) DueSessions(nowMs int64) ([]string, error) {
	rows, err := r.DB.Query(`SELECT id FROM computer_sessions WHERE ended_at = 0 AND deadline_at <= ?`, nowMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			out = append(out, id)
		}
	}
	return out, nil
}

// SessionsNearingEnd: sesi aktif yang tersisa <= withinMinutes dan belum
// dikirim peringatan (warn_sent_at = 0).
func (r *ComputerRepository) SessionsNearingEnd(nowMs int64, withinMinutes int) ([]models.ComputerSession, error) {
	threshold := nowMs + int64(withinMinutes)*60_000
	rows, err := r.DB.Query(sessionSelect+`
		WHERE s.ended_at = 0 AND s.warn_sent_at = 0 AND s.deadline_at <= ? AND s.deadline_at > ?
		ORDER BY s.deadline_at
	`, threshold, nowMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.ComputerSession{}
	for rows.Next() {
		s, err := r.scanSession(rows)
		if err != nil {
			continue
		}
		out = append(out, *s)
	}
	return out, nil
}

func (r *ComputerRepository) MarkWarnSent(sessionID string) {
	_, _ = r.DB.Exec(`UPDATE computer_sessions SET warn_sent_at = ? WHERE id = ?`, UnixMilli(), sessionID)
}

// ExpireBookings menandai booking 'booked' yang slot-nya sudah lewat sebagai
// no_show/expired.
func (r *ComputerRepository) ExpireBookings(nowMs int64) (int64, error) {
	res, err := r.DB.Exec(`
		UPDATE computer_bookings SET status = 'expired', updated_at = ?
		WHERE status = 'booked' AND slot_end < ?
	`, UnixMilli(), nowMs)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}

// ---------- internal helpers ----------

const bookingSelect = `
	SELECT b.id, b.station_id, COALESCE(st.name,''), b.student_id, b.student_name, b.class_name,
	       b.report_id, b.slot_start, b.slot_end, b.planned_minutes, b.status, COALESCE(b.notes,''),
	       b.created_by, COALESCE(b.created_at,0), COALESCE(b.updated_at,0)
	FROM computer_bookings b
	LEFT JOIN computer_stations st ON st.id = b.station_id
`

const sessionSelect = `
	SELECT s.id, s.booking_id, s.station_id, COALESCE(st.name,''), s.student_id, s.student_name,
	       s.started_at, s.deadline_at, s.ended_at, s.minutes_used, COALESCE(s.end_reason,''),
	       COALESCE(s.created_at,0), COALESCE(s.updated_at,0)
	FROM computer_sessions s
	LEFT JOIN computer_stations st ON st.id = s.station_id
`

func (r *ComputerRepository) scanBooking(row rowScanner) (*models.ComputerBooking, error) {
	var (
		b         models.ComputerBooking
		reportID  sql.NullString
		createdBy sql.NullString
		ss, se    sql.NullInt64
		ca, ua    sql.NullInt64
	)
	if err := row.Scan(&b.ID, &b.StationID, &b.StationName, &b.StudentID, &b.StudentName, &b.ClassName,
		&reportID, &ss, &se, &b.PlannedMinutes, &b.Status, &b.Notes, &createdBy, &ca, &ua); err != nil {
		return nil, err
	}
	if reportID.Valid {
		b.ReportID = &reportID.String
	}
	if createdBy.Valid {
		b.CreatedBy = &createdBy.String
	}
	b.SlotStart = msToTime(ss)
	b.SlotEnd = msToTime(se)
	b.CreatedAt = msToTime(ca)
	b.UpdatedAt = msToTime(ua)
	return &b, nil
}

func (r *ComputerRepository) scanSession(row rowScanner) (*models.ComputerSession, error) {
	var (
		s          models.ComputerSession
		bookingID  sql.NullString
		startedAt  sql.NullInt64
		deadlineAt sql.NullInt64
		endedAt    sql.NullInt64
		ca, ua     sql.NullInt64
	)
	if err := row.Scan(&s.ID, &bookingID, &s.StationID, &s.StationName, &s.StudentID, &s.StudentName,
		&startedAt, &deadlineAt, &endedAt, &s.MinutesUsed, &s.EndReason, &ca, &ua); err != nil {
		return nil, err
	}
	if bookingID.Valid {
		s.BookingID = &bookingID.String
	}
	s.StartedAt = msToTime(startedAt)
	s.DeadlineAt = msToTime(deadlineAt)
	if endedAt.Valid && endedAt.Int64 > 0 {
		t := time.UnixMilli(endedAt.Int64)
		s.EndedAt = &t
	}
	s.CreatedAt = msToTime(ca)
	s.UpdatedAt = msToTime(ua)
	return &s, nil
}

func (r *ComputerRepository) stationByID(id string) (*models.ComputerStation, error) {
	var s models.ComputerStation
	var ls, ca, ua sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT id, code, name, COALESCE(location,''), sort_order, status,
		       COALESCE(last_seen_at,0), COALESCE(created_at,0), COALESCE(updated_at,0)
		FROM computer_stations WHERE id = ?
	`, id).Scan(&s.ID, &s.Code, &s.Name, &s.Location, &s.SortOrder, &s.Status, &ls, &ca, &ua)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	s.LastSeenAt = msToTime(ls)
	s.CreatedAt = msToTime(ca)
	s.UpdatedAt = msToTime(ua)
	return &s, nil
}

func scanReadingReports(rows *sql.Rows) ([]models.ReadingReport, error) {
	out := []models.ReadingReport{}
	for rows.Next() {
		var (
			m          models.ReadingReport
			catalogID  sql.NullString
			reviewedBy sql.NullString
			reviewedAt sql.NullInt64
			ca, ua     sql.NullInt64
		)
		if err := rows.Scan(&m.ID, &m.StudentID, &m.StudentName, &m.ClassName, &catalogID, &m.BookTitle, &m.BookAuthor,
			&m.Summary, &m.Conclusion, &m.Question, &m.Status, &m.ReviewNotes,
			&reviewedBy, &reviewedAt, &ca, &ua); err != nil {
			continue
		}
		if catalogID.Valid {
			m.CatalogID = &catalogID.String
		}
		if reviewedBy.Valid {
			m.ReviewedBy = &reviewedBy.String
		}
		if reviewedAt.Valid && reviewedAt.Int64 > 0 {
			t := time.UnixMilli(reviewedAt.Int64)
			m.ReviewedAt = &t
		}
		m.CreatedAt = msToTime(ca)
		m.UpdatedAt = msToTime(ua)
		out = append(out, m)
	}
	return out, nil
}

// msToTime mengubah epoch ms (NullInt64) menjadi time.Time (zero bila kosong).
func msToTime(ni sql.NullInt64) time.Time {
	if !ni.Valid || ni.Int64 == 0 {
		return time.Time{}
	}
	return time.UnixMilli(ni.Int64)
}

// parseTimeFlexible menerima RFC3339 atau epoch-ms sebagai string.
func parseTimeFlexible(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, errors.New("kosong")
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	ms, err := strconv.ParseInt(s, 10, 64)
	if err == nil && ms > 0 {
		if ms < 1e12 { // kemungkinan detik
			return time.Unix(ms, 0), nil
		}
		return time.UnixMilli(ms), nil
	}
	return time.Time{}, errors.New("format waktu tidak dikenali")
}
