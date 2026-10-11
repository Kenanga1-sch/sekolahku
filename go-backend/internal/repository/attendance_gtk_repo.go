package repository

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
)

// ErrOutOfRadius dikembalikan bila lokasi scan di luar radius titik presensi.
var ErrOutOfRadius = errors.New("lokasi di luar radius presensi")

// ErrNotAttendanceRequired dikembalikan bila GTK (PNS/PPPK) tidak wajib presensi.
var ErrNotAttendanceRequired = errors.New("gtk ini tidak wajib presensi")

// AttendanceGTKRepository mengelola presensi GTK (guru & tenaga kependidikan)
// lewat scan kartu GTK. Terpisah dari attendance_records (siswa): GTK tanpa
// sesi/kelas, rekam idempotent per (employee, date).
//
// Sejak 000084: hanya GTK non-ASN (GTT/GTY/Honorer/PTT) + Pembina Ekskul yang
// wajib presensi (attendance_required=1). PNS/PPPK/P3K dikecualikan. Presensi
// divalidasi radius lokasi (haversine) terhadap titik presensi aktif.
type AttendanceGTKRepository struct {
	DB *sql.DB
}

func NewAttendanceGTKRepository(db *sql.DB) *AttendanceGTKRepository {
	return &AttendanceGTKRepository{DB: db}
}

// GTKAttendanceRow adalah satu baris rekap presensi GTK.
type GTKAttendanceRow struct {
	EmployeeID    string   `json:"employeeId"`
	Name          string   `json:"name"`
	Category      string   `json:"category"`
	NIP           string   `json:"nip"`
	EmploymentStatus string `json:"employmentStatus"`
	Date          string   `json:"date"`
	Status        string   `json:"status"`
	CheckIn       string   `json:"checkIn"`
	AttendeeType  string   `json:"attendeeType"`
	DistanceM     *float64 `json:"distanceM,omitempty"`
	WithinRadius  *bool    `json:"withinRadius,omitempty"`
	PointName     string   `json:"pointName,omitempty"`
	ExtracurricularName string `json:"extracurricularName,omitempty"`
}

// ScanOutcome hasil pemrosesan satu scan presensi GTK.
type ScanOutcome struct {
	EmployeeID  string
	Name        string
	Category    string
	Already     bool
	DistanceM   float64
	WithinRad   bool
	PointName   string
	Status      string
}

// ScanGTK mencatat kehadiran GTK (idempotent per employee+date). Validasi:
//   - GTK harus ber-status wajib presensi (attendance_required=1),
//   - bila koordinat dikirim, jarak ke titik harus dalam radius (kecuali override).
//
// Mengembalikan ScanOutcome + error. ErrStudentNotFound bila kode tak dikenal,
// ErrNotAttendanceRequired bila ASN, ErrOutOfRadius bila di luar radius.
func (r *AttendanceGTKRepository) ScanGTK(req ScanGTKRequest) (*ScanOutcome, error) {
	code := strings.TrimSpace(req.QRCode)
	status := normalizeAttendanceStatus(req.Status)
	if !isValidAttendanceStatus(status) {
		return nil, ErrInvalidStatus
	}

	// Resolve GTK + status wajib presensi.
	var employeeID, name, category string
	var required int
	err := r.DB.QueryRow(`
		SELECT id, COALESCE(name, ''), COALESCE(category, ''), COALESCE(attendance_required, 0)
		FROM employee_details
		WHERE qr_code = ? OR nip = ? OR nuptk = ? OR id = ?
		LIMIT 1
	`, code, code, code, code).Scan(&employeeID, &name, &category, &required)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrStudentNotFound
		}
		return nil, err
	}
	if required == 0 {
		return nil, ErrNotAttendanceRequired
	}

	// Resolve titik presensi (eksplisit / titik ekskul / default sekolah).
	point, err := r.resolvePoint(req.PointID, req.ExtracurricularID)
	if err != nil {
		return nil, err
	}

	// Hitung jarak bila koordinat dikirim & titik punya koordinat valid.
	var distanceM float64
	withinRad := true
	hasGeo := req.Latitude != nil && req.Longitude != nil && point != nil &&
		(point.Latitude != 0 || point.Longitude != 0)
	if hasGeo {
		distanceM = haversineM(*req.Latitude, *req.Longitude, point.Latitude, point.Longitude)
		withinRad = withinRadius(distanceM, point.RadiusM)
	}

	today := TodayJakarta()
	now := time.Now().UnixMilli()

	// Cek sudah tercatat hari ini.
	var existing string
	err = r.DB.QueryRow(`
		SELECT id FROM employee_attendance WHERE employee_id = ? AND date = ?
	`, employeeID, today).Scan(&existing)
	if err == nil {
		return &ScanOutcome{
			EmployeeID: employeeID, Name: name, Category: category,
			Already: true, DistanceM: distanceM, WithinRad: withinRad,
			PointName: pointName(point), Status: status,
		}, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	// Bila di luar radius & bukan override → tolak (tidak dicatat).
	if hasGeo && !withinRad && !req.OverrideRadius {
		return &ScanOutcome{
			EmployeeID: employeeID, Name: name, Category: category,
			DistanceM: distanceM, WithinRad: false,
			PointName: pointName(point), Status: status,
		}, ErrOutOfRadius
	}

	attendeeType := "gtk"
	var ekskulID interface{}
	if req.ExtracurricularID != nil && strings.TrimSpace(*req.ExtracurricularID) != "" {
		attendeeType = "ekskul"
		ekskulID = *req.ExtracurricularID
	}

	var lat, lng, dist interface{}
	var within interface{}
	var pointID, pName, overrideReason interface{}
	if hasGeo {
		lat = *req.Latitude
		lng = *req.Longitude
		dist = distanceM
		if withinRad {
			within = 1
		} else {
			within = 0
		}
	}
	if point != nil {
		pointID = point.ID
		pName = point.Name
	}
	if req.OverrideRadius && req.OverrideReason != "" {
		overrideReason = strings.TrimSpace(req.OverrideReason)
	}

	_, err = r.DB.Exec(`
		INSERT INTO employee_attendance
			(id, employee_id, date, status, check_in_time, recorded_by, record_method, notes,
			 created_at, updated_at, attendee_type, extracurricular_id, latitude, longitude,
			 distance_m, within_radius, point_id, point_name, status_override_reason)
		VALUES (?, ?, ?, ?, ?, ?, 'scan', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(employee_id, date) DO NOTHING
	`, cuid2.Generate(), employeeID, today, status, now, req.RecordedBy, now, now,
		attendeeType, ekskulID, lat, lng, dist, within, pointID, pName, overrideReason)
	if err != nil {
		return nil, err
	}

	return &ScanOutcome{
		EmployeeID: employeeID, Name: name, Category: category,
		DistanceM: distanceM, WithinRad: withinRad,
		PointName: pointName(point), Status: status,
	}, nil
}

// ScanGTKRequest parameter scan (didefinisikan di sini agar repo mandiri).
type ScanGTKRequest struct {
	QRCode            string
	Status            string
	RecordedBy        string
	Latitude          *float64
	Longitude         *float64
	PointID           *string
	ExtracurricularID *string
	OverrideRadius    bool
	OverrideReason    string
}

// pointRef titik presensi hasil resolusi.
type pointRef struct {
	ID        string
	Name      string
	Latitude  float64
	Longitude float64
	RadiusM   int
}

func pointName(p *pointRef) string {
	if p == nil {
		return ""
	}
	return p.Name
}

// resolvePoint menentukan titik presensi: eksplisit → titik ekskul → default sekolah.
func (r *AttendanceGTKRepository) resolvePoint(pointID, ekskulID *string) (*pointRef, error) {
	// 1. Titik eksplisit.
	if pointID != nil && strings.TrimSpace(*pointID) != "" {
		if p, err := r.getPoint(*pointID); err == nil && p != nil {
			return p, nil
		}
	}
	// 2. Titik khusus ekskul (bila sesi ekskul & pengajar punya point_id).
	if ekskulID != nil && strings.TrimSpace(*ekskulID) != "" {
		var pid sql.NullString
		_ = r.DB.QueryRow(`SELECT point_id FROM extracurricular_teachers WHERE id = ?`, *ekskulID).Scan(&pid)
		if pid.Valid && pid.String != "" {
			if p, err := r.getPoint(pid.String); err == nil && p != nil {
				return p, nil
			}
		}
	}
	// 3. Titik default "sekolah" (atau titik aktif pertama).
	var id string
	err := r.DB.QueryRow(`
		SELECT id FROM attendance_points
		WHERE is_active = 1
		ORDER BY CASE WHEN point_type = 'sekolah' THEN 0 ELSE 1 END, created_at ASC
		LIMIT 1
	`).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // belum ada titik → radius tidak divalidasi
		}
		return nil, err
	}
	return r.getPoint(id)
}

func (r *AttendanceGTKRepository) getPoint(id string) (*pointRef, error) {
	var p pointRef
	var lat, lng sql.NullFloat64
	var radius sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT id, COALESCE(name,''), latitude, longitude, COALESCE(radius_m, 100)
		FROM attendance_points WHERE id = ? AND is_active = 1
	`, id).Scan(&p.ID, &p.Name, &lat, &lng, &radius)
	if err != nil {
		return nil, err
	}
	if lat.Valid {
		p.Latitude = lat.Float64
	}
	if lng.Valid {
		p.Longitude = lng.Float64
	}
	if radius.Valid {
		p.RadiusM = int(radius.Int64)
	}
	return &p, nil
}

// GetGTKDaily rekap presensi GTK pada satu tanggal — hanya yang wajib presensi
// (attendance_required=1). Yang belum absen = status kosong.
func (r *AttendanceGTKRepository) GetGTKDaily(date string) ([]GTKAttendanceRow, error) {
	if strings.TrimSpace(date) == "" {
		date = TodayJakarta()
	}
	rows, err := r.DB.Query(gtkSelectQuery+`
		WHERE ed.attendance_required = 1
		ORDER BY ed.name ASC
	`, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanGTKRows(rows)
}

// GetGTKReport rekap presensi GTK dalam rentang tanggal (hanya wajib presensi).
func (r *AttendanceGTKRepository) GetGTKReport(startDate, endDate string) ([]GTKAttendanceRow, error) {
	rows, err := r.DB.Query(gtkSelectQuery+`
		WHERE ed.attendance_required = 1 AND ea.date BETWEEN ? AND ?
		ORDER BY ed.name ASC, ea.date ASC
	`, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanGTKRows(rows)
}

// GetEkskulDaily rekap sesi presensi ekskul pada satu tanggal.
func (r *AttendanceGTKRepository) GetEkskulDaily(date string) ([]GTKAttendanceRow, error) {
	if strings.TrimSpace(date) == "" {
		date = TodayJakarta()
	}
	rows, err := r.DB.Query(gtkSelectQuery+`
		WHERE ea.date = ? AND ea.attendee_type = 'ekskul'
		ORDER BY et.extracurricular_name ASC, ed.name ASC
	`, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanGTKRows(rows)
}

// gtkSelectQuery kolom dasar rekap presensi GTK (JOIN titik & ekskul).
const gtkSelectQuery = `
	SELECT ed.id, COALESCE(ed.name,''), COALESCE(ed.category,''), COALESCE(ed.nip,''),
	       COALESCE(ed.employment_status,''),
	       COALESCE(ea.date,''), COALESCE(ea.status,''),
	       COALESCE(CAST(ea.check_in_time AS TEXT),''),
	       COALESCE(ea.attendee_type,'gtk'),
	       ea.distance_m, ea.within_radius, COALESCE(ea.point_name,''),
	       COALESCE(et.extracurricular_name,'')
	FROM employee_details ed
	LEFT JOIN employee_attendance ea ON ea.employee_id = ed.id
	LEFT JOIN extracurricular_teachers et ON et.id = ea.extracurricular_id
`

func scanGTKRows(rows *sql.Rows) ([]GTKAttendanceRow, error) {
	out := []GTKAttendanceRow{}
	for rows.Next() {
		var r GTKAttendanceRow
		var checkIn string
		var dist sql.NullFloat64
		var within sql.NullInt64
		var attendeeType, pointName, ekskulName string
		if err := rows.Scan(&r.EmployeeID, &r.Name, &r.Category, &r.NIP, &r.EmploymentStatus,
			&r.Date, &r.Status, &checkIn, &attendeeType, &dist, &within, &pointName, &ekskulName); err != nil {
			return nil, err
		}
		r.CheckIn = checkIn
		r.AttendeeType = attendeeType
		r.PointName = pointName
		r.ExtracurricularName = ekskulName
		if dist.Valid {
			d := dist.Float64
			r.DistanceM = &d
		}
		if within.Valid {
			w := within.Int64 == 1
			r.WithinRadius = &w
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// ==========================================================================
// Titik presensi (attendance_points)
// ==========================================================================

func (r *AttendanceGTKRepository) ListPoints() ([]AttendancePointRow, error) {
	rows, err := r.DB.Query(`
		SELECT id, name, COALESCE(point_type,'custom'), ref_id, latitude, longitude,
		       COALESCE(radius_m, 100), COALESCE(is_active, 1)
		FROM attendance_points
		ORDER BY CASE WHEN point_type = 'sekolah' THEN 0 ELSE 1 END, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AttendancePointRow{}
	for rows.Next() {
		var p AttendancePointRow
		var refID sql.NullString
		var lat, lng sql.NullFloat64
		var active int
		if err := rows.Scan(&p.ID, &p.Name, &p.PointType, &refID, &lat, &lng, &p.RadiusM, &active); err != nil {
			return nil, err
		}
		if refID.Valid {
			p.RefID = &refID.String
		}
		if lat.Valid {
			p.Latitude = lat.Float64
		}
		if lng.Valid {
			p.Longitude = lng.Float64
		}
		p.IsActive = active == 1
		out = append(out, p)
	}
	return out, rows.Err()
}

// AttendancePointRow baris titik presensi (JSON camelCase).
type AttendancePointRow struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	PointType string  `json:"pointType"`
	RefID     *string `json:"refId,omitempty"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	RadiusM   int     `json:"radiusM"`
	IsActive  bool    `json:"isActive"`
}

func (r *AttendanceGTKRepository) CreatePoint(name, pointType string, refID *string, lat, lng float64, radiusM int, isActive bool) (string, error) {
	id := "point_" + cuid2.Generate()
	now := time.Now().UnixMilli()
	active := 0
	if isActive {
		active = 1
	}
	if strings.TrimSpace(pointType) == "" {
		pointType = "custom"
	}
	_, err := r.DB.Exec(`
		INSERT INTO attendance_points (id, name, point_type, ref_id, latitude, longitude, radius_m, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, name, pointType, refID, lat, lng, radiusM, active, now, now)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (r *AttendanceGTKRepository) UpdatePoint(id, name, pointType string, refID *string, lat, lng float64, radiusM int, isActive bool) error {
	now := time.Now().UnixMilli()
	active := 0
	if isActive {
		active = 1
	}
	_, err := r.DB.Exec(`
		UPDATE attendance_points
		SET name=?, point_type=?, ref_id=?, latitude=?, longitude=?, radius_m=?, is_active=?, updated_at=?
		WHERE id=?
	`, name, pointType, refID, lat, lng, radiusM, active, now, id)
	return err
}

func (r *AttendanceGTKRepository) DeletePoint(id string) error {
	_, err := r.DB.Exec(`DELETE FROM attendance_points WHERE id = ? AND point_type != 'sekolah'`, id)
	return err
}

// ==========================================================================
// Pengajar ekstrakurikuler (extracurricular_teachers)
// ==========================================================================

func (r *AttendanceGTKRepository) ListEkskulTeachers() ([]EkskulTeacherRow, error) {
	rows, err := r.DB.Query(`
		SELECT et.id, et.employee_id, COALESCE(ed.name,''), COALESCE(ed.nip,''),
		       et.extracurricular_name, et.schedule, et.point_id, COALESCE(ap.name,''),
		       COALESCE(et.is_active, 1)
		FROM extracurricular_teachers et
		JOIN employee_details ed ON ed.id = et.employee_id
		LEFT JOIN attendance_points ap ON ap.id = et.point_id
		ORDER BY et.extracurricular_name ASC, ed.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []EkskulTeacherRow{}
	for rows.Next() {
		var t EkskulTeacherRow
		var nip, schedule, pointID, pointName sql.NullString
		var active int
		if err := rows.Scan(&t.ID, &t.EmployeeID, &t.Name, &nip, &t.ExtracurricularName,
			&schedule, &pointID, &pointName, &active); err != nil {
			return nil, err
		}
		if nip.Valid {
			t.NIP = &nip.String
		}
		if schedule.Valid {
			t.Schedule = &schedule.String
		}
		if pointID.Valid {
			t.PointID = &pointID.String
		}
		if pointName.Valid && pointName.String != "" {
			t.PointName = &pointName.String
		}
		t.IsActive = active == 1
		out = append(out, t)
	}
	return out, rows.Err()
}

// EkskulTeacherRow baris pengajar ekskul (JSON camelCase).
type EkskulTeacherRow struct {
	ID                  string  `json:"id"`
	EmployeeID          string  `json:"employeeId"`
	Name                string  `json:"name"`
	NIP                 *string `json:"nip,omitempty"`
	ExtracurricularName string  `json:"extracurricularName"`
	Schedule            *string `json:"schedule,omitempty"`
	PointID             *string `json:"pointId,omitempty"`
	PointName           *string `json:"pointName,omitempty"`
	IsActive            bool    `json:"isActive"`
}

func (r *AttendanceGTKRepository) AssignEkskul(employeeID, ekskulName string, schedule, pointID *string, isActive bool) (string, error) {
	id := "eks_" + cuid2.Generate()
	now := time.Now().UnixMilli()
	active := 0
	if isActive {
		active = 1
	}
	_, err := r.DB.Exec(`
		INSERT INTO extracurricular_teachers (id, employee_id, extracurricular_name, schedule, point_id, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, employeeID, ekskulName, schedule, pointID, active, now, now)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (r *AttendanceGTKRepository) UpdateEkskul(id, ekskulName string, schedule, pointID *string, isActive bool) error {
	now := time.Now().UnixMilli()
	active := 0
	if isActive {
		active = 1
	}
	_, err := r.DB.Exec(`
		UPDATE extracurricular_teachers
		SET extracurricular_name=?, schedule=?, point_id=?, is_active=?, updated_at=?
		WHERE id=?
	`, ekskulName, schedule, pointID, active, now, id)
	return err
}

func (r *AttendanceGTKRepository) RemoveEkskul(id string) error {
	_, err := r.DB.Exec(`DELETE FROM extracurricular_teachers WHERE id = ?`, id)
	return err
}

// GetEkskulForEmployee mengembalikan daftar ekskul yang diampu satu GTK.
func (r *AttendanceGTKRepository) GetEkskulForEmployee(employeeID string) ([]EkskulTeacherRow, error) {
	rows, err := r.DB.Query(`
		SELECT et.id, et.employee_id, COALESCE(ed.name,''), COALESCE(ed.nip,''),
		       et.extracurricular_name, et.schedule, et.point_id, COALESCE(ap.name,''),
		       COALESCE(et.is_active, 1)
		FROM extracurricular_teachers et
		JOIN employee_details ed ON ed.id = et.employee_id
		LEFT JOIN attendance_points ap ON ap.id = et.point_id
		WHERE et.employee_id = ?
		ORDER BY et.extracurricular_name ASC
	`, employeeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []EkskulTeacherRow{}
	for rows.Next() {
		var t EkskulTeacherRow
		var nip, schedule, pointID, pointName sql.NullString
		var active int
		if err := rows.Scan(&t.ID, &t.EmployeeID, &t.Name, &nip, &t.ExtracurricularName,
			&schedule, &pointID, &pointName, &active); err != nil {
			return nil, err
		}
		if nip.Valid {
			t.NIP = &nip.String
		}
		if schedule.Valid {
			t.Schedule = &schedule.String
		}
		if pointID.Valid {
			t.PointID = &pointID.String
		}
		if pointName.Valid && pointName.String != "" {
			t.PointName = &pointName.String
		}
		t.IsActive = active == 1
		out = append(out, t)
	}
	return out, rows.Err()
}
