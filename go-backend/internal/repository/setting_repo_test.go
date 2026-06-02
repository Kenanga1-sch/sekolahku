package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupSettingTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE school_settings (
			id TEXT PRIMARY KEY,
			school_name TEXT NOT NULL,
			school_npsn TEXT,
			school_address TEXT,
			school_phone TEXT,
			school_email TEXT,
			school_website TEXT,
			school_logo TEXT,
			school_lat REAL,
			school_lng REAL,
			max_distance_km REAL,
			spmb_is_open BOOLEAN DEFAULT 0,
			current_academic_year TEXT,
			principal_name TEXT,
			principal_nip TEXT,
			is_maintenance BOOLEAN DEFAULT 0,
			last_letter_number INTEGER DEFAULT 0,
			letter_number_format TEXT,
			savings_treasurer_id TEXT,
			school_vision TEXT,
			school_mission TEXT,
			school_indicators TEXT,
			school_history_timeline TEXT,
			school_history_achievements TEXT,
			school_curriculum TEXT,
			school_extracurriculars TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("failed to create settings schema: %v", err)
	}

	return db
}

func TestSettingRepositoryUpdatePreservesProfileFields(t *testing.T) {
	db := setupSettingTestDB(t)
	defer db.Close()

	_, err := db.Exec(`
		INSERT INTO school_settings (
			id, school_name, school_lat, school_lng, max_distance_km,
			spmb_is_open, current_academic_year, letter_number_format,
			savings_treasurer_id, school_vision, school_mission,
			school_history_timeline, school_curriculum, created_at, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "settings-1", "UPTD SDN 1 Kenanga", -6.2, 106.8, 3.0, true,
		"2026/2027", "421/{nomor}/SDN1/{bulan}/{tahun}", "treasurer-1",
		"Visi lama", `["Misi lama"]`, `[{"year":"1970"}]`,
		`{"description":"Kurikulum lama"}`, int64(1), int64(1))
	if err != nil {
		t.Fatalf("failed to seed settings: %v", err)
	}

	repo := NewSettingRepository(db)
	updated, err := repo.UpdateSettings(models.SchoolSettings{
		SchoolName:          "UPTD SDN 1 Kenanga Baru",
		CurrentAcademicYear: "2027/2028",
		SPMBIsOpen:          true,
		LetterNumberFormat:  "421/{nomor}/SDN1-KNG/{bulan}/{tahun}",
	})
	if err != nil {
		t.Fatalf("UpdateSettings returned error: %v", err)
	}

	if updated.SchoolVision == nil || *updated.SchoolVision != "Visi lama" {
		t.Fatalf("expected existing vision to be preserved, got %#v", updated.SchoolVision)
	}
	if updated.SchoolMission == nil || *updated.SchoolMission != `["Misi lama"]` {
		t.Fatalf("expected existing mission to be preserved, got %#v", updated.SchoolMission)
	}
	if updated.SavingsTreasurerID == nil || *updated.SavingsTreasurerID != "treasurer-1" {
		t.Fatalf("expected savings treasurer to be preserved, got %#v", updated.SavingsTreasurerID)
	}
	if updated.MaxDistanceKM == nil || *updated.MaxDistanceKM != 3.0 {
		t.Fatalf("expected max distance to be preserved, got %#v", updated.MaxDistanceKM)
	}
}
