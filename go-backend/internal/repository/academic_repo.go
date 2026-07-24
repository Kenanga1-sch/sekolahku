package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type AcademicRepository struct {
	DB *sql.DB
}

func NewAcademicRepository(db *sql.DB) *AcademicRepository {
	return &AcademicRepository{DB: db}
}

// GetActiveAcademicYear returns the active academic year string name (e.g. "2024/2025")
func (r *AcademicRepository) GetActiveAcademicYear() (string, error) {
	// 1. Try to find active academic year in academic_years table
	query := `SELECT name FROM academic_years WHERE is_active = 1 LIMIT 1`
	var activeYearName string
	err := r.DB.QueryRow(query).Scan(&activeYearName)

	if err == nil {
		return activeYearName, nil
	}

	// If the error is not "no rows in result set", something went wrong with DB
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	// 2. Fallback to school_settings
	queryFallback := `SELECT current_academic_year FROM school_settings LIMIT 1`
	var currentAcademicYear sql.NullString
	err = r.DB.QueryRow(queryFallback).Scan(&currentAcademicYear)

	if err == nil && currentAcademicYear.Valid {
		return currentAcademicYear.String, nil
	}

	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	// 3. Final Fallback
	return "2024/2025", nil
}

func (r *AcademicRepository) GetClasses() ([]models.AcademicClass, error) {
	// Default: filter by active academic year
	activeYear, err := r.GetActiveAcademicYear()
	if err != nil {
		activeYear = "2024/2025"
	}
	return r.getClassesByYear(activeYear)
}

func (r *AcademicRepository) getClassesByYear(academicYear string) ([]models.AcademicClass, error) {
	query := `SELECT id, name, grade, academic_year, teacher_name, capacity, is_active FROM student_classes WHERE academic_year = ? ORDER BY grade ASC, name ASC`
	rows, err := r.DB.Query(query, academicYear)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classes []models.AcademicClass
	for rows.Next() {
		var c models.AcademicClass
		var teacherName sql.NullString
		err := rows.Scan(&c.ID, &c.Name, &c.Grade, &c.AcademicYear, &teacherName, &c.Capacity, &c.IsActive)
		if err != nil {
			return nil, err
		}
		if teacherName.Valid {
			c.TeacherName = &teacherName.String
		}
		classes = append(classes, c)
	}
	if classes == nil {
		classes = []models.AcademicClass{}
	}
	return classes, nil
}

func (r *AcademicRepository) GetClassByID(id string) (*models.AcademicClass, error) {
	query := `SELECT id, name, grade, academic_year, teacher_name, capacity, is_active FROM student_classes WHERE id = ?`
	var c models.AcademicClass
	var teacherName sql.NullString
	err := r.DB.QueryRow(query, id).Scan(&c.ID, &c.Name, &c.Grade, &c.AcademicYear, &teacherName, &c.Capacity, &c.IsActive)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if teacherName.Valid {
		c.TeacherName = &teacherName.String
	}
	return &c, nil
}

func (r *AcademicRepository) CreateClass(c models.AcademicClass) error {
	query := `INSERT INTO student_classes (id, name, grade, academic_year, teacher_name, capacity, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	now := time.Now().Unix()
	_, err := r.DB.Exec(query, c.ID, c.Name, c.Grade, c.AcademicYear, c.TeacherName, c.Capacity, 1, now, now)
	return err
}

func (r *AcademicRepository) UpdateClass(id string, c models.AcademicClass) error {
	now := time.Now().Unix()

	// Get old name for cascade
	var oldName string
	if err := r.DB.QueryRow(`SELECT name FROM student_classes WHERE id = ?`, id).Scan(&oldName); err != nil {
		return err
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `UPDATE student_classes SET name = ?, grade = ?, capacity = ?, updated_at = ? WHERE id = ?`
	if _, err := tx.Exec(query, c.Name, c.Grade, c.Capacity, now, id); err != nil {
		return err
	}

	// Cascade rename to students
	if c.Name != oldName {
		if _, err := tx.Exec(`UPDATE students SET class_name = ? WHERE class_id = ?`, c.Name, id); err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE student_class_history SET class_name = ? WHERE class_id = ?`, c.Name, id); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *AcademicRepository) DeleteClass(id string) error {
	var activeStudents int
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM students WHERE class_id = ? AND status = 'active'`, id).Scan(&activeStudents); err != nil {
		return err
	}
	if activeStudents > 0 {
		return fmt.Errorf("kelas masih memiliki %d siswa aktif", activeStudents)
	}

	query := `DELETE FROM student_classes WHERE id = ?`
	_, err := r.DB.Exec(query, id)
	return err
}

// --- ACADEMIC YEARS CRUD ---

func (r *AcademicRepository) GetAcademicYears() ([]models.AcademicYear, error) {
	query := `SELECT id, name, semester, is_active, start_date, end_date, created_at, updated_at FROM academic_years ORDER BY created_at DESC`
	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.AcademicYear
	for rows.Next() {
		var y models.AcademicYear
		var start, end sql.NullString
		var created, updated sql.NullInt64
		err := rows.Scan(&y.ID, &y.Name, &y.Semester, &y.IsActive, &start, &end, &created, &updated)
		if err != nil {
			return nil, err
		}
		if start.Valid {
			y.StartDate = &start.String
		}
		if end.Valid {
			y.EndDate = &end.String
		}
		if created.Valid {
			t := time.Unix(created.Int64, 0)
			y.CreatedAt = &t
		}
		if updated.Valid {
			t := time.Unix(updated.Int64, 0)
			y.UpdatedAt = &t
		}
		results = append(results, y)
	}
	if results == nil {
		results = []models.AcademicYear{}
	}
	return results, nil
}

func (r *AcademicRepository) CreateAcademicYear(y models.AcademicYear) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if y.IsActive {
		_, err = tx.Exec(`UPDATE academic_years SET is_active = 0`)
		if err != nil {
			return err
		}
	}

	now := time.Now().Unix()
	query := `INSERT INTO academic_years (id, name, semester, is_active, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(query, y.ID, y.Name, y.Semester, y.IsActive, y.StartDate, y.EndDate, now, now)
	if err != nil {
		return err
	}
	if y.IsActive {
		if _, err = tx.Exec(`UPDATE school_settings SET current_academic_year = ?`, y.Name); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *AcademicRepository) UpdateAcademicYear(id string, y models.AcademicYear) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if y.IsActive {
		_, err = tx.Exec(`UPDATE academic_years SET is_active = 0`)
		if err != nil {
			return err
		}
	}

	now := time.Now().Unix()
	query := `UPDATE academic_years SET name = ?, semester = ?, is_active = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ?`
	_, err = tx.Exec(query, y.Name, y.Semester, y.IsActive, y.StartDate, y.EndDate, now, id)
	if err != nil {
		return err
	}
	if y.IsActive {
		if _, err = tx.Exec(`UPDATE school_settings SET current_academic_year = ?`, y.Name); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *AcademicRepository) DeleteAcademicYear(id string) error {
	// Don't delete active year
	var isActive bool
	err := r.DB.QueryRow(`SELECT is_active FROM academic_years WHERE id = ?`, id).Scan(&isActive)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil // Already deleted or not found
		}
		return err
	}
	if isActive {
		return fmt.Errorf("Cannot delete active academic year")
	}

	_, err = r.DB.Exec(`DELETE FROM academic_years WHERE id = ?`, id)
	return err
}

// --- SUBJECTS CRUD ---

func (r *AcademicRepository) GetSubjects() ([]models.Subject, error) {
	query := `SELECT id, code, name, category, description, created_at, updated_at FROM subjects ORDER BY code ASC`
	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.Subject
	for rows.Next() {
		var s models.Subject
		var desc sql.NullString
		var created, updated sql.NullInt64
		err := rows.Scan(&s.ID, &s.Code, &s.Name, &s.Category, &desc, &created, &updated)
		if err != nil {
			return nil, err
		}
		if desc.Valid {
			s.Description = desc.String
		}
		if created.Valid {
			t := time.Unix(created.Int64, 0)
			s.CreatedAt = &t
		}
		if updated.Valid {
			t := time.Unix(updated.Int64, 0)
			s.UpdatedAt = &t
		}
		results = append(results, s)
	}
	if results == nil {
		results = []models.Subject{}
	}
	return results, nil
}

func (r *AcademicRepository) CreateSubject(s models.Subject) error {
	now := time.Now().Unix()
	query := `INSERT INTO subjects (id, code, name, category, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := r.DB.Exec(query, s.ID, s.Code, s.Name, s.Category, s.Description, now, now)
	return err
}

func (r *AcademicRepository) UpdateSubject(id string, s models.Subject) error {
	now := time.Now().Unix()
	query := `UPDATE subjects SET code = ?, name = ?, category = ?, description = ?, updated_at = ? WHERE id = ?`
	_, err := r.DB.Exec(query, s.Code, s.Name, s.Category, s.Description, now, id)
	return err
}

func (r *AcademicRepository) DeleteSubject(id string) error {
	_, err := r.DB.Exec(`DELETE FROM subjects WHERE id = ?`, id)
	return err
}

func (r *AcademicRepository) ProcessPromotion(req models.PromotionRequest) (int, error) {
	if req.TargetClassId == nil || *req.TargetClassId == "" {
		return 0, fmt.Errorf("kelas tujuan wajib dipilih")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	now := time.Now().Unix()
	count := 0

	// Get Target Class Info
	var targetClassName string
	var targetGrade int
	var targetAcademicYear string
	var targetCapacity int
	err = tx.QueryRow(`SELECT name, grade, academic_year, capacity FROM student_classes WHERE id = ?`, *req.TargetClassId).Scan(&targetClassName, &targetGrade, &targetAcademicYear, &targetCapacity)
	if err != nil {
		return 0, fmt.Errorf("Target class not found")
	}

	var currentCount int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM students WHERE class_id = ? AND status = 'active'`, *req.TargetClassId).Scan(&currentCount); err != nil {
		return 0, err
	}
	if targetCapacity > 0 && currentCount+len(req.StudentIds) > targetCapacity {
		return 0, fmt.Errorf("kapasitas kelas tujuan tidak mencukupi")
	}

	for _, studentId := range req.StudentIds {
		// Update student
		_, err = tx.Exec(`UPDATE students SET class_id = ?, class_name = ?, updated_at = ? WHERE id = ?`, *req.TargetClassId, targetClassName, now, studentId)
		if err != nil {
			return count, err
		}

		// Insert history
		historyId := cuid2.Generate()
		_, err = tx.Exec(`
			INSERT INTO student_class_history (id, student_id, class_id, class_name, academic_year, grade, status, record_date)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, historyId, studentId, *req.TargetClassId, targetClassName, targetAcademicYear, targetGrade, "promoted", now)
		if err != nil {
			return count, err
		}
		count++
	}

	err = tx.Commit()
	return count, err
}

func (r *AcademicRepository) GetClassesWithStats() ([]models.ClassStats, error) {
	activeYear, err := r.GetActiveAcademicYear()
	if err != nil {
		activeYear = "2024/2025"
	}

	query := `
		SELECT c.id, c.name, c.grade, c.capacity, COUNT(s.id) as student_count
		FROM student_classes c
		LEFT JOIN students s ON c.id = s.class_id AND s.is_active = 1
		WHERE c.academic_year = ?
		GROUP BY c.id
		ORDER BY c.grade ASC, c.name ASC
	`
	rows, err := r.DB.Query(query, activeYear)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.ClassStats
	for rows.Next() {
		var s models.ClassStats
		err := rows.Scan(&s.ID, &s.Name, &s.Grade, &s.Capacity, &s.StudentCount)
		if err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	if results == nil {
		results = []models.ClassStats{}
	}
	return results, nil
}
