package repository

import (
	"database/sql"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type SyncRepository struct {
	DB *sql.DB
}

func NewSyncRepository(db *sql.DB) *SyncRepository {
	return &SyncRepository{DB: db}
}

func parseGrade(name string) int {
	name = strings.ToUpper(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, "KELAS", "")
	name = strings.TrimSpace(name)

	switch name {
	case "1", "I", "SATU":
		return 1
	case "2", "II", "DUA":
		return 2
	case "3", "III", "TIGA":
		return 3
	case "4", "IV", "EMPAT":
		return 4
	case "5", "V", "LIMA":
		return 5
	case "6", "VI", "ENAM":
		return 6
	}

	if strings.Contains(name, "VI") {
		return 6
	} else if strings.Contains(name, "IV") {
		return 4
	} else if strings.Contains(name, "III") {
		return 3
	} else if strings.Contains(name, "II") {
		return 2
	} else if strings.Contains(name, "I") {
		return 1
	} else if strings.Contains(name, "V") {
		return 5
	}

	for _, char := range name {
		if char >= '1' && char <= '9' {
			return int(char - '0')
		}
	}
	return 1
}

// UpsertStudent will insert or update a student based on NISN or NIK
func (r *SyncRepository) UpsertStudent(s models.Student) error {
	var existingID string

	// Try to find by NISN
	if s.NISN != nil && *s.NISN != "" {
		r.DB.QueryRow("SELECT id FROM students WHERE nisn = ?", *s.NISN).Scan(&existingID)
	}
	// Try by NIK if not found
	if existingID == "" && s.NIK != nil && *s.NIK != "" {
		r.DB.QueryRow("SELECT id FROM students WHERE nik = ?", *s.NIK).Scan(&existingID)
	}

	now := time.Now().UnixMilli()

	// Look up class ID for the student's class name
	var classIDVal interface{} = nil
	if s.ClassName != nil && *s.ClassName != "" {
		var classID string
		err := r.DB.QueryRow("SELECT id FROM student_classes WHERE name = ?", *s.ClassName).Scan(&classID)
		if err == nil {
			classIDVal = classID
		}
	}

	if existingID != "" {
		// Update existing
		_, err := r.DB.Exec(`
			UPDATE students SET 
				nik=COALESCE(?, nik), nis=COALESCE(?, nis), full_name=?, gender=COALESCE(?, gender),
				birth_place=COALESCE(?, birth_place), birth_date=COALESCE(?, birth_date), religion=COALESCE(?, religion),
				address=COALESCE(?, address), parent_name=COALESCE(?, parent_name), father_name=COALESCE(?, father_name), 
				mother_name=COALESCE(?, mother_name), guardian_name=COALESCE(?, guardian_name), 
				parent_phone=COALESCE(?, parent_phone), class_name=COALESCE(?, class_name), class_id=?,
				kip=COALESCE(?, kip), meta_data=COALESCE(?, meta_data), updated_at=?
			WHERE id=?
		`, s.NIK, s.NIS, s.FullName, s.Gender,
			s.BirthPlace, s.BirthDate, s.Religion,
			s.Address, s.ParentName, s.FatherName,
			s.MotherName, s.GuardianName,
			s.ParentPhone, s.ClassName, classIDVal,
			s.KIP, s.MetaData, now, existingID)
		if err == nil {
			_ = AutoSyncStudentToSavingsAndLibrary(r.DB, existingID)
		}
		return err
	}

	// Insert new
	if s.ID == "" {
		s.ID = cuid2.Generate()
	}
	if s.Status == "" {
		s.Status = "active"
	}
	if s.QRCode == "" {
		s.QRCode = s.ID
	}

	_, err := r.DB.Exec(`
		INSERT INTO students (
			id, nik, nisn, nis, full_name, gender, birth_place, birth_date, religion,
			address, parent_name, father_name, mother_name, guardian_name,
			parent_phone, class_name, class_id, status, qr_code, is_active, created_at, updated_at, kip, meta_data
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
	`, s.ID, s.NIK, s.NISN, s.NIS, s.FullName, s.Gender, s.BirthPlace, s.BirthDate, s.Religion,
		s.Address, s.ParentName, s.FatherName, s.MotherName, s.GuardianName,
		s.ParentPhone, s.ClassName, classIDVal, s.Status, s.QRCode, now, now, s.KIP, s.MetaData)

	if err == nil {
		_ = AutoSyncStudentToSavingsAndLibrary(r.DB, s.ID)
	}

	return err
}

// EnsureClass exists
func (r *SyncRepository) EnsureClass(className string) error {
	className = strings.TrimSpace(className)
	if className == "" {
		return nil
	}
	var existingID string
	err := r.DB.QueryRow("SELECT id FROM student_classes WHERE name = ?", className).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	if existingID == "" {
		id := cuid2.Generate()
		now := time.Now().UnixMilli()

		// Get active academic year
		academicYear := "2024/2025" // default fallback
		var activeYearName string
		err = r.DB.QueryRow("SELECT name FROM academic_years WHERE is_active = 1 LIMIT 1").Scan(&activeYearName)
		if err == nil {
			academicYear = activeYearName
		} else {
			var fallbackYear sql.NullString
			err = r.DB.QueryRow("SELECT current_academic_year FROM school_settings LIMIT 1").Scan(&fallbackYear)
			if err == nil && fallbackYear.Valid {
				academicYear = fallbackYear.String
			}
		}

		grade := parseGrade(className)
		_, err = r.DB.Exec(`
			INSERT INTO student_classes (id, name, grade, academic_year, is_active, capacity, created_at, updated_at)
			VALUES (?, ?, ?, ?, 1, 28, ?, ?)
		`, id, className, grade, academicYear, now, now)
		return err
	}
	return nil
}
