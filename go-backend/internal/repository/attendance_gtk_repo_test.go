package repository

import (
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

// setupGtkAttendanceTestDB membuat skema minimal untuk menguji presensi GTK
// versi 000084 (attendance_required, attendance_points, extracurricular_teachers,
// kolom geo di employee_attendance).
func setupGtkAttendanceTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE employee_details (
			id TEXT PRIMARY KEY, name TEXT, nip TEXT, nuptk TEXT,
			qr_code TEXT, category TEXT, employment_status TEXT,
			attendance_required INTEGER DEFAULT 0
		);
		CREATE TABLE employee_attendance (
			id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, date TEXT NOT NULL,
			status TEXT DEFAULT 'hadir', check_in_time INTEGER, recorded_by TEXT,
			record_method TEXT DEFAULT 'scan', notes TEXT, created_at INTEGER, updated_at INTEGER,
			attendee_type TEXT DEFAULT 'gtk', extracurricular_id TEXT,
			latitude REAL, longitude REAL, distance_m REAL, within_radius INTEGER,
			point_id TEXT, point_name TEXT, status_override_reason TEXT
		);
		CREATE UNIQUE INDEX idx_employee_attendance_unique ON employee_attendance(employee_id, date);
		CREATE TABLE attendance_points (
			id TEXT PRIMARY KEY, name TEXT, point_type TEXT DEFAULT 'custom', ref_id TEXT,
			latitude REAL, longitude REAL, radius_m INTEGER DEFAULT 100,
			is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE extracurricular_teachers (
			id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, extracurricular_name TEXT NOT NULL,
			schedule TEXT, point_id TEXT, is_active INTEGER DEFAULT 1,
			created_at INTEGER, updated_at INTEGER
		);
		INSERT INTO employee_details (id, name, nip, qr_code, category, employment_status, attendance_required) VALUES
			('emp-1', 'Budi', '197001011990031001', 'GTK-197001011990031001', 'guru', 'Honorer', 1),
			('emp-2', 'Siti', NULL, 'GTK-EMP-2', 'staff', 'PNS', 0),
			('emp-3', 'Andi', NULL, 'GTK-EMP-3', 'guru', 'P3K', 0);
		INSERT INTO attendance_points (id, name, point_type, latitude, longitude, radius_m, is_active) VALUES
			('point_sekolah_default', 'Sekolah', 'sekolah', -6.3275, 108.3208, 100, 1);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

func TestAttendanceGTKScanIdempotentPerDay(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	out, err := repo.ScanGTK(ScanGTKRequest{QRCode: "GTK-197001011990031001", RecordedBy: "u1"})
	if err != nil || out.Already || out.Name != "Budi" || out.Category != "guru" {
		t.Fatalf("first scan: name=%q cat=%q already=%v err=%v", out.Name, out.Category, out.Already, err)
	}
	// Scan ulang → already, tidak dobel.
	out, err = repo.ScanGTK(ScanGTKRequest{QRCode: "197001011990031001", Status: "hadir", RecordedBy: "u1"})
	if err != nil || !out.Already {
		t.Fatalf("second scan should be already=true: already=%v err=%v", out.Already, err)
	}
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM employee_attendance`).Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 record, got %d", count)
	}
}

func TestAttendanceGTKUnknownAndInvalidStatus(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	if _, err := repo.ScanGTK(ScanGTKRequest{QRCode: "TIDAK-ADA", RecordedBy: "u1"}); !errors.Is(err, ErrStudentNotFound) {
		t.Fatalf("expected ErrStudentNotFound, got %v", err)
	}
	if _, err := repo.ScanGTK(ScanGTKRequest{QRCode: "GTK-197001011990031001", Status: "entah", RecordedBy: "u1"}); !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("expected ErrInvalidStatus, got %v", err)
	}
}

// PNS/PPPK/P3K tidak wajib presensi → ErrNotAttendanceRequired.
func TestAttendanceGTKExcludesASN(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	if _, err := repo.ScanGTK(ScanGTKRequest{QRCode: "GTK-EMP-2", RecordedBy: "u1"}); !errors.Is(err, ErrNotAttendanceRequired) {
		t.Fatalf("PNS harus ditolak, got %v", err)
	}
	if _, err := repo.ScanGTK(ScanGTKRequest{QRCode: "GTK-EMP-3", RecordedBy: "u1"}); !errors.Is(err, ErrNotAttendanceRequired) {
		t.Fatalf("P3K harus ditolak, got %v", err)
	}
}

// Scan di dalam radius → tercatat; di luar radius → ErrOutOfRadius, tidak tercatat.
func TestAttendanceGTKRadiusEnforced(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	// Di luar radius (~1 km).
	far := -6.3375
	farLng := 108.3208
	_, err := repo.ScanGTK(ScanGTKRequest{
		QRCode: "GTK-197001011990031001", RecordedBy: "u1",
		Latitude: &far, Longitude: &farLng,
	})
	if !errors.Is(err, ErrOutOfRadius) {
		t.Fatalf("di luar radius harus ErrOutOfRadius, got %v", err)
	}
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM employee_attendance`).Scan(&count)
	if count != 0 {
		t.Fatalf("scan luar radius tidak boleh tercatat, count=%d", count)
	}

	// Di dalam radius (~10 m dari titik).
	near := -6.32755
	nearLng := 108.32081
	out, err := repo.ScanGTK(ScanGTKRequest{
		QRCode: "GTK-197001011990031001", RecordedBy: "u1",
		Latitude: &near, Longitude: &nearLng,
	})
	if err != nil || !out.WithinRad {
		t.Fatalf("di dalam radius harus tercatat, err=%v within=%v", err, out.WithinRad)
	}
	db.QueryRow(`SELECT COUNT(*) FROM employee_attendance`).Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 record, got %d", count)
	}
}

// Override radius oleh bendahara dengan alasan → tercatat walau di luar radius.
func TestAttendanceGTKRadiusOverride(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	far := -6.3375
	farLng := 108.3208
	out, err := repo.ScanGTK(ScanGTKRequest{
		QRCode: "GTK-197001011990031001", RecordedBy: "admin",
		Latitude: &far, Longitude: &farLng,
		OverrideRadius: true, OverrideReason: "dinas luar",
	})
	if err != nil {
		t.Fatalf("override harus berhasil, err=%v", err)
	}
	if out.WithinRad {
		t.Fatal("withinRad harus false (di luar radius) meski di-override")
	}
	var reason sql.NullString
	db.QueryRow(`SELECT status_override_reason FROM employee_attendance LIMIT 1`).Scan(&reason)
	if !reason.Valid || reason.String != "dinas luar" {
		t.Fatalf("alasan override harus tersimpan, got %v", reason)
	}
}

func TestAttendanceGTKDailyOnlyRequired(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	if _, err := repo.ScanGTK(ScanGTKRequest{QRCode: "GTK-197001011990031001", RecordedBy: "u1"}); err != nil {
		t.Fatal(err)
	}
	rows, err := repo.GetGTKDaily(TodayJakarta())
	if err != nil {
		t.Fatal(err)
	}
	// Hanya emp-1 (Honorer) yang wajib presensi → 1 baris, emp-2/emp-3 ASN tak muncul.
	if len(rows) != 1 {
		t.Fatalf("expected hanya GTK wajib presensi, got %d", len(rows))
	}
	if rows[0].Status != "hadir" {
		t.Fatalf("expected hadir, got %q", rows[0].Status)
	}
}

func TestAttendanceGTKEkskulFlow(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	eksID, err := repo.AssignEkskul("emp-1", "Pramuka", nil, nil, true)
	if err != nil {
		t.Fatal(err)
	}
	list, err := repo.ListEkskulTeachers()
	if err != nil || len(list) != 1 || list[0].ExtracurricularName != "Pramuka" {
		t.Fatalf("ekskul list: %+v err=%v", list, err)
	}

	out, err := repo.ScanGTK(ScanGTKRequest{
		QRCode: "GTK-197001011990031001", RecordedBy: "u1", ExtracurricularID: &eksID,
	})
	if err != nil {
		t.Fatalf("scan ekskul: %v", err)
	}
	if out.Name != "Budi" {
		t.Fatalf("expected Budi, got %q", out.Name)
	}
	rows, err := repo.GetEkskulDaily(TodayJakarta())
	if err != nil || len(rows) != 1 {
		t.Fatalf("ekskul daily: %+v err=%v", rows, err)
	}
	if rows[0].AttendeeType != "ekskul" || rows[0].ExtracurricularName != "Pramuka" {
		t.Fatalf("attendee ekskul salah: %+v", rows[0])
	}

	if err := repo.RemoveEkskul(eksID); err != nil {
		t.Fatal(err)
	}
	list, _ = repo.ListEkskulTeachers()
	if len(list) != 0 {
		t.Fatalf("ekskul harus terhapus, got %d", len(list))
	}
}

func TestAttendancePointCRUD(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	id, err := repo.CreatePoint("Lapangan", "custom", nil, -6.3280, 108.3210, 150, true)
	if err != nil {
		t.Fatal(err)
	}
	points, err := repo.ListPoints()
	if err != nil || len(points) != 2 { // sekolah default + Lapangan
		t.Fatalf("points: %+v err=%v", points, err)
	}
	if err := repo.UpdatePoint(id, "Lapangan Bola", "custom", nil, -6.3281, 108.3211, 200, true); err != nil {
		t.Fatal(err)
	}
	points, _ = repo.ListPoints()
	found := false
	for _, p := range points {
		if p.ID == id && p.Name == "Lapangan Bola" && p.RadiusM == 200 {
			found = true
		}
	}
	if !found {
		t.Fatalf("update titik gagal: %+v", points)
	}
	if err := repo.DeletePoint(id); err != nil {
		t.Fatal(err)
	}
	// Titik "sekolah" tidak boleh terhapus.
	if err := repo.DeletePoint("point_sekolah_default"); err != nil {
		t.Fatal(err)
	}
	points, _ = repo.ListPoints()
	for _, p := range points {
		if p.PointType == "sekolah" {
			return
		}
	}
	t.Fatal("titik sekolah harus tetap ada")
}

func TestIsAttendanceRequired(t *testing.T) {
	required := []string{"GTT", "gty", "Honorer", "ptt", "Pembina Ekskul", "Guru Tidak Tetap"}
	for _, s := range required {
		if !IsAttendanceRequired(s) {
			t.Errorf("%q harus wajib presensi", s)
		}
	}
	for _, s := range []string{"PNS", "P3K", "PPPK", "PPPK PW", "", "  "} {
		if IsAttendanceRequired(s) {
			t.Errorf("%q tidak boleh wajib presensi", s)
		}
	}
}

func TestHaversineM(t *testing.T) {
	// ~111.19 km per derajat lintang di ekuator; di sini sekitar 1 km untuk 0.009°.
	d := haversineM(-6.3275, 108.3208, -6.3365, 108.3208)
	if d < 950 || d > 1050 {
		t.Fatalf("jarak 0.009° lintang harus ~1000 m, got %.1f", d)
	}
	if got := haversineM(-6.3275, 108.3208, -6.3275, 108.3208); got != 0 {
		t.Fatalf("jarak titik sama harus 0, got %v", got)
	}
}

func TestAttendanceGTKMonthlyReport(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	// Candra (Honorer, emp-1) hadir 2 hari; emp-2/emp-3 (ASN) tak wajib → tak muncul.
	today := TodayJakarta()
	_ = today
	// Insert presensi pada tanggal tertentu (bukan hanya hari ini).
	now := int64(0)
	_, err := db.Exec(`INSERT INTO employee_attendance (id, employee_id, date, status, check_in_time, created_at, updated_at, attendee_type) VALUES
		('a1','emp-1','2026-10-05','hadir',0,?,?, 'gtk'),
		('a2','emp-1','2026-10-06','sakit',0,?,?, 'gtk')`, now, now, now, now)
	if err != nil {
		t.Fatal(err)
	}

	report, err := repo.GetGTKMonthlyReport(2026, 10, "")
	if err != nil {
		t.Fatal(err)
	}
	if report.Year != 2026 || report.Month != 10 {
		t.Fatalf("periode salah: %+v", report)
	}
	if report.EffectiveDays <= 0 {
		t.Fatalf("effectiveDays harus > 0, got %d", report.EffectiveDays)
	}
	if len(report.Rows) != 1 {
		t.Fatalf("hanya GTK wajib presensi (emp-1) yang tampil, got %d", len(report.Rows))
	}
	r := report.Rows[0]
	if r.EmployeeID != "emp-1" || r.TotalHadir != 1 || r.TotalSakit != 1 {
		t.Fatalf("rekap salah: %+v", r)
	}
	if r.DailyStatus["2026-10-05"] != "hadir" {
		t.Fatalf("daily status 05 salah: %+v", r.DailyStatus)
	}
}
