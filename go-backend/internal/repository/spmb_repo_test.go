package repository

import (
	"database/sql"
	"testing"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupSPMBTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE school_settings (
			id TEXT PRIMARY KEY,
			school_name TEXT,
			school_npsn TEXT,
			school_address TEXT,
			school_phone TEXT,
			school_email TEXT,
			school_lat REAL,
			school_lng REAL,
			spmb_is_open INTEGER DEFAULT 1,
			current_academic_year TEXT,
			max_distance_km REAL DEFAULT 3,
			principal_name TEXT,
			principal_nip TEXT
		);
		INSERT INTO school_settings (id, current_academic_year, spmb_is_open, max_distance_km) VALUES ('default', '2026/2027', 1, 3);
		CREATE TABLE spmb_periods (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			year TEXT,
			academic_year TEXT,
			committee_name TEXT,
			start_date INTEGER,
			end_date INTEGER,
			status TEXT DEFAULT 'draft',
			quota INTEGER DEFAULT 100,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE spmb_registrants (
			id TEXT PRIMARY KEY,
			registration_number TEXT UNIQUE NOT NULL,
			full_name TEXT NOT NULL,
			nisn TEXT,
			student_nik TEXT,
			kk_number TEXT,
			birth_certificate_no TEXT,
			birth_place TEXT,
			birth_date TEXT,
			gender TEXT,
			religion TEXT,
			special_needs TEXT,
			living_arrangement TEXT,
			transport_mode TEXT,
			child_order INTEGER,
			has_kps_pkh INTEGER DEFAULT 0,
			has_kip INTEGER DEFAULT 0,
			previous_school TEXT,
			hobby TEXT,
			ambition TEXT,
			height INTEGER,
			weight INTEGER,
			head_circumference INTEGER,
			sibling_count INTEGER,
			travel_time TEXT,
			address_street TEXT,
			address_rt TEXT,
			address_rw TEXT,
			address_village TEXT,
			postal_code TEXT,
			home_address TEXT,
			home_lat REAL,
			home_lng REAL,
			distance_km REAL,
			is_in_zone INTEGER DEFAULT 0,
			parent_phone TEXT,
			parent_email TEXT,
			father_name TEXT,
			father_nik TEXT,
			father_birth_year TEXT,
			father_education TEXT,
			father_job TEXT,
			father_income TEXT,
			mother_name TEXT,
			mother_nik TEXT,
			mother_birth_year TEXT,
			mother_education TEXT,
			mother_job TEXT,
			mother_income TEXT,
			guardian_name TEXT,
			guardian_nik TEXT,
			guardian_birth_year TEXT,
			guardian_education TEXT,
			guardian_job TEXT,
			guardian_income TEXT,
			status TEXT DEFAULT 'pending',
			notes TEXT,
			period_id TEXT,
			documents TEXT,
			verified_by TEXT,
			verified_at INTEGER,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE student_classes (
			id TEXT PRIMARY KEY,
			name TEXT,
			academic_year TEXT
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			nik TEXT,
			nisn TEXT,
			full_name TEXT,
			gender TEXT,
			birth_place TEXT,
			birth_date TEXT,
			religion TEXT,
			address TEXT,
			father_name TEXT,
			father_nik TEXT,
			mother_name TEXT,
			mother_nik TEXT,
			guardian_name TEXT,
			guardian_nik TEXT,
			guardian_job TEXT,
			parent_phone TEXT,
			class_id TEXT,
			class_name TEXT,
			status TEXT,
			is_active INTEGER,
			enrolled_at INTEGER,
			created_at INTEGER,
			updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

func TestSPMBRepositoryPeriodPatchPreservesFields(t *testing.T) {
	db := setupSPMBTestDB(t)
	defer db.Close()
	repo := NewSPMBRepository(db)

	period, err := repo.CreatePeriod(models.CreateSPMBPeriodRequest{
		Name:      "SPMB 2026/2027",
		StartDate: "2026-06-01",
		EndDate:   "2026-07-01",
		Quota:     64,
		IsActive:  true,
	})
	if err != nil {
		t.Fatalf("create period: %v", err)
	}

	periods, err := repo.GetPeriods()
	if err != nil {
		t.Fatalf("get periods: %v", err)
	}
	if len(periods) != 1 || !periods[0].IsActive || periods[0].AcademicYear != "2026/2027" {
		t.Fatalf("unexpected created period: %+v", periods)
	}

	inactive := false
	if err := repo.UpdatePeriod(period.ID, models.UpdateSPMBPeriodRequest{IsActive: &inactive}); err != nil {
		t.Fatalf("deactivate period: %v", err)
	}
	periods, err = repo.GetPeriods()
	if err != nil {
		t.Fatalf("get periods after patch: %v", err)
	}
	if periods[0].Name != "SPMB 2026/2027" || periods[0].Quota != 64 || periods[0].IsActive {
		t.Fatalf("partial update did not preserve fields: %+v", periods[0])
	}
}

func TestSPMBRepositoryRegistrantsAllFilterAndStats(t *testing.T) {
	db := setupSPMBTestDB(t)
	defer db.Close()
	repo := NewSPMBRepository(db)
	now := time.Now().UnixMilli()
	_, err := db.Exec(`INSERT INTO spmb_periods (id, name, year, academic_year, status, quota, created_at) VALUES ('p1', 'SPMB', '2026', '2026/2027', 'active', 10, ?)`, now)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`
		INSERT INTO spmb_registrants (id, registration_number, full_name, student_nik, birth_date, gender, distance_km, is_in_zone, status, period_id, created_at)
		VALUES
		('r1', 'SPMB-2026-0001', 'Siswa Satu', '111', '2020-01-02', 'L', 1.2, 1, 'pending', 'p1', ?),
		('r2', 'SPMB-2026-0002', 'Siswa Dua', '222', '2020-02-03', 'P', 4.5, 0, 'rejected', 'p1', ?)
	`, now, now-1)
	if err != nil {
		t.Fatal(err)
	}

	items, total, err := repo.GetRegistrantsAdmin(1, 10, "all", "")
	if err != nil {
		t.Fatalf("get registrants: %v", err)
	}
	if total != 2 || len(items) != 2 || items[0].BirthDate == "" || items[0].DistanceKM == 0 {
		t.Fatalf("unexpected registrants result total=%d items=%+v", total, items)
	}

	stats, err := repo.GetSPMBStats()
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if stats.TotalRegistrants != 2 || stats.PendingRegistrants != 1 || stats.RejectedRegistrants != 1 {
		t.Fatalf("unexpected stats: %+v", stats)
	}
}

func TestSPMBRepositoryPublicRegistrantsOnlyShowsResults(t *testing.T) {
	db := setupSPMBTestDB(t)
	defer db.Close()
	repo := NewSPMBRepository(db)
	now := time.Now().UnixMilli()

	_, err := db.Exec(`
		INSERT INTO spmb_registrants (id, registration_number, full_name, status, created_at)
		VALUES
		('r1', 'SPMB-2026-0001', 'Siswa Pending', 'pending', ?),
		('r2', 'SPMB-2026-0002', 'Siswa Diterima', 'accepted', ?),
		('r3', 'SPMB-2026-0003', 'Siswa Ditolak', 'rejected', ?)
	`, now, now+1, now+2)
	if err != nil {
		t.Fatal(err)
	}

	items, err := repo.GetPublicRegistrants()
	if err != nil {
		t.Fatalf("get public registrants: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected accepted/rejected only, got %+v", items)
	}
	if items[0].Status != "accepted" || items[1].Status != "rejected" {
		t.Fatalf("unexpected public result order/statuses: %+v", items)
	}
}

func TestSPMBRepositoryCreateRegistrantAssignsPeriod(t *testing.T) {
	db := setupSPMBTestDB(t)
	defer db.Close()
	repo := NewSPMBRepository(db)
	now := time.Now().UnixMilli()
	_, err := db.Exec(`INSERT INTO spmb_periods (id, name, year, academic_year, status, quota, created_at) VALUES ('p1', 'SPMB', '2026', '2026/2027', 'active', 10, ?)`, now)
	if err != nil {
		t.Fatal(err)
	}

	_, regNumber, err := repo.CreateRegistrant(models.SPMBRegistrant{
		PeriodID:       "p1",
		FullName:       "Siswa Baru",
		StudentNIK:     "333",
		NISN:           "999",
		BirthPlace:     "Indramayu",
		BirthDate:      "2020-03-04",
		Gender:         "P",
		Religion:       "Islam",
		HomeAddress:    "Jl. Rumah",
		DistanceKM:     1.5,
		ParentPhone:    "0812",
		FatherName:     "Ayah",
		MotherName:     "Ibu",
		AddressVillage: "Kenanga",
	})
	if err != nil {
		t.Fatalf("create registrant: %v", err)
	}
	if regNumber == "" {
		t.Fatal("registration number should be generated")
	}

	var periodID, status, birthDate string
	if err := db.QueryRow(`SELECT period_id, status, birth_date FROM spmb_registrants WHERE student_nik = '333'`).Scan(&periodID, &status, &birthDate); err != nil {
		t.Fatal(err)
	}
	if periodID != "p1" || status != "pending" || birthDate != "2020-03-04" {
		t.Fatalf("unexpected created registrant period=%s status=%s birthDate=%s", periodID, status, birthDate)
	}
}

func TestSPMBRepositoryCreateRegistrantDetectsDuplicateStudentNIK(t *testing.T) {
	db := setupSPMBTestDB(t)
	defer db.Close()
	repo := NewSPMBRepository(db)
	now := time.Now().UnixMilli()
	_, err := db.Exec(`
		INSERT INTO spmb_registrants (id, registration_number, full_name, student_nik, status, created_at)
		VALUES ('r1', 'SPMB-2026-0001', 'Siswa Lama', '9998887776665554', 'pending', ?)
	`, now)
	if err != nil {
		t.Fatal(err)
	}

	id, regNumber, err := repo.CreateRegistrant(models.SPMBRegistrant{
		FullName:   "Siswa Baru",
		StudentNIK: "9998887776665554",
	})
	if err == nil {
		t.Fatal("expected duplicate NIK error")
	}
	duplicate, ok := err.(*DuplicateSPMBRegistrantError)
	if !ok {
		t.Fatalf("expected DuplicateSPMBRegistrantError, got %T: %v", err, err)
	}
	if id != "r1" || regNumber != "SPMB-2026-0001" || duplicate.RegistrationNumber != "SPMB-2026-0001" {
		t.Fatalf("unexpected duplicate payload id=%s reg=%s err=%+v", id, regNumber, duplicate)
	}
}

func TestSPMBRepositoryPromoteToStudentUsesClassID(t *testing.T) {
	db := setupSPMBTestDB(t)
	defer db.Close()
	repo := NewSPMBRepository(db)
	now := time.Now().UnixMilli()
	_, err := db.Exec(`INSERT INTO student_classes (id, name, academic_year) VALUES ('class-1', '1A', '2026/2027')`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`
		INSERT INTO spmb_registrants (
			id, registration_number, full_name, nisn, student_nik, birth_place, birth_date, gender, religion,
			home_address, father_name, father_nik, mother_name, mother_nik, parent_phone, status, created_at
		) VALUES ('r1', 'SPMB-2026-0001', 'Siswa Satu', '12345', '111', 'Indramayu', '2020-01-02', 'L', 'Islam',
			'Jl. Rumah', 'Ayah', '321', 'Ibu', '654', '0812', 'accepted', ?)
	`, now)
	if err != nil {
		t.Fatal(err)
	}

	if err := repo.PromoteToStudent("r1", models.SPMBPromoteRequest{ClassID: "class-1"}); err != nil {
		t.Fatalf("promote: %v", err)
	}

	var classID, className, nik, status string
	if err := db.QueryRow(`SELECT class_id, class_name, nik, status FROM students LIMIT 1`).Scan(&classID, &className, &nik, &status); err != nil {
		t.Fatal(err)
	}
	if classID != "class-1" || className != "1A" || nik != "111" || status != "active" {
		t.Fatalf("unexpected promoted student classID=%s className=%s nik=%s status=%s", classID, className, nik, status)
	}
}
