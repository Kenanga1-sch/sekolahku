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

	if existingID != "" {
		// Update existing
		_, err := r.DB.Exec(`
			UPDATE students SET 
				nik=COALESCE(?, nik), nis=COALESCE(?, nis), full_name=?, gender=COALESCE(?, gender),
				birth_place=COALESCE(?, birth_place), birth_date=COALESCE(?, birth_date), religion=COALESCE(?, religion),
				address=COALESCE(?, address), parent_name=COALESCE(?, parent_name), father_name=COALESCE(?, father_name), 
				mother_name=COALESCE(?, mother_name), guardian_name=COALESCE(?, guardian_name), 
				parent_phone=COALESCE(?, parent_phone), class_name=COALESCE(?, class_name),
				updated_at=?
			WHERE id=?
		`, s.NIK, s.NIS, s.FullName, s.Gender,
			s.BirthPlace, s.BirthDate, s.Religion,
			s.Address, s.ParentName, s.FatherName,
			s.MotherName, s.GuardianName,
			s.ParentPhone, s.ClassName,
			now, existingID)
		return err
	}

	// Insert new
	if s.ID == "" {
		s.ID = cuid2.Generate()
	}
	if s.Status == "" {
		s.Status = "active"
	}

	_, err := r.DB.Exec(`
		INSERT INTO students (
			id, nik, nisn, nis, full_name, gender, birth_place, birth_date, religion,
			address, parent_name, father_name, mother_name, guardian_name,
			parent_phone, class_name, status, is_active, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.ID, s.NIK, s.NISN, s.NIS, s.FullName, s.Gender, s.BirthPlace, s.BirthDate, s.Religion,
		s.Address, s.ParentName, s.FatherName, s.MotherName, s.GuardianName,
		s.ParentPhone, s.ClassName, s.Status, 1, now, now)

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
		_, err = r.DB.Exec("INSERT INTO student_classes (id, name, created_at) VALUES (?, ?, ?)", id, className, now)
		return err
	}
	return nil
}
