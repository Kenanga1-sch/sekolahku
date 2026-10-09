package repository

import (
	"database/sql"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
)

// AttendanceGTKRepository mengelola presensi GTK (guru & tenaga kependidikan)
// lewat scan kartu GTK. Terpisah dari attendance_records (siswa): GTK tanpa
// sesi/kelas, rekam idempotent per (employee, date).
type AttendanceGTKRepository struct {
	DB *sql.DB
}

func NewAttendanceGTKRepository(db *sql.DB) *AttendanceGTKRepository {
	return &AttendanceGTKRepository{DB: db}
}

// ScanGTK mencatat kehadiran GTK hari ini (idempotent per employee+date).
// Scan ulang di hari yang sama tidak membuat record ganda — mengembalikan
// flag already=true. Mengembalikan (nil, false, err) bila GTK tidak dikenal.
func (r *AttendanceGTKRepository) ScanGTK(code, status, recordedBy string) (name string, category string, already bool, employeeID string, err error) {
	code = strings.TrimSpace(code)
	status = normalizeAttendanceStatus(status)
	if !isValidAttendanceStatus(status) {
		return "", "", false, "", ErrInvalidStatus
	}

	// Resolve GTK (qr_code / nip / nuptk / id).
	err = r.DB.QueryRow(`
		SELECT id, COALESCE(name, ''), COALESCE(category, '')
		FROM employee_details
		WHERE qr_code = ? OR nip = ? OR nuptk = ? OR id = ?
		LIMIT 1
	`, code, code, code, code).Scan(&employeeID, &name, &category)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", "", false, "", ErrStudentNotFound
		}
		return "", "", false, "", err
	}

	today := TodayJakarta()
	now := time.Now().UnixMilli()

	// Cek sudah hadir hari ini.
	var existing string
	err = r.DB.QueryRow(`
		SELECT id FROM employee_attendance WHERE employee_id = ? AND date = ?
	`, employeeID, today).Scan(&existing)
	if err == nil {
		return name, category, true, employeeID, nil
	}
	if err != sql.ErrNoRows {
		return "", "", false, "", err
	}

	_, err = r.DB.Exec(`
		INSERT INTO employee_attendance (id, employee_id, date, status, check_in_time, recorded_by, record_method, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'scan', ?, ?)
		ON CONFLICT(employee_id, date) DO NOTHING
	`, cuid2.Generate(), employeeID, today, status, now, recordedBy, now, now)
	if err != nil {
		return "", "", false, "", err
	}
	return name, category, false, employeeID, nil
}

// GTKAttendanceRow adalah satu baris rekap presensi GTK.
type GTKAttendanceRow struct {
	EmployeeID string `json:"employeeId"`
	Name       string `json:"name"`
	Category   string `json:"category"`
	NIP        string `json:"nip"`
	Date       string `json:"date"`
	Status     string `json:"status"`
	CheckIn    string `json:"checkIn"`
}

// GetGTKDaily rekap presensi GTK pada satu tanggal (semua GTK + statusnya;
// yang belum absen = status kosong).
func (r *AttendanceGTKRepository) GetGTKDaily(date string) ([]GTKAttendanceRow, error) {
	if strings.TrimSpace(date) == "" {
		date = TodayJakarta()
	}
	rows, err := r.DB.Query(`
		SELECT ed.id, COALESCE(ed.name,''), COALESCE(ed.category,''), COALESCE(ed.nip,''),
		       COALESCE(ea.date,''), COALESCE(ea.status,''),
		       COALESCE(CAST(ea.check_in_time AS TEXT),'')
		FROM employee_details ed
		LEFT JOIN employee_attendance ea ON ea.employee_id = ed.id AND ea.date = ?
		ORDER BY ed.name ASC
	`, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanGTKRows(rows)
}

// GetGTKReport rekap presensi GTK dalam rentang tanggal (per orang per tanggal).
func (r *AttendanceGTKRepository) GetGTKReport(startDate, endDate string) ([]GTKAttendanceRow, error) {
	rows, err := r.DB.Query(`
		SELECT ed.id, COALESCE(ed.name,''), COALESCE(ed.category,''), COALESCE(ed.nip,''),
		       COALESCE(ea.date,''), COALESCE(ea.status,''),
		       COALESCE(CAST(ea.check_in_time AS TEXT),'')
		FROM employee_details ed
		LEFT JOIN employee_attendance ea ON ea.employee_id = ed.id AND ea.date BETWEEN ? AND ?
		ORDER BY ed.name ASC, ea.date ASC
	`, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanGTKRows(rows)
}

func scanGTKRows(rows *sql.Rows) ([]GTKAttendanceRow, error) {
	out := []GTKAttendanceRow{}
	for rows.Next() {
		var r GTKAttendanceRow
		var checkIn string
		if err := rows.Scan(&r.EmployeeID, &r.Name, &r.Category, &r.NIP, &r.Date, &r.Status, &checkIn); err != nil {
			return nil, err
		}
		r.CheckIn = checkIn
		out = append(out, r)
	}
	return out, rows.Err()
}
