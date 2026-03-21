package repository

import (
	"database/sql"
	"fmt"
	"math"

	"github.com/sekolahku/go-backend/internal/models"
)

type StudentRepository struct {
	DB *sql.DB
}

func NewStudentRepository(db *sql.DB) *StudentRepository {
	return &StudentRepository{DB: db}
}

func (r *StudentRepository) GetStudentsWithMeta(page, limit int, search, className, isActiveStr string) (*models.StudentResponse, error) {
	offset := (page - 1) * limit

	whereClause := "1=1"
	var args []interface{}

	if search != "" {
		whereClause += " AND (full_name LIKE ? OR nisn LIKE ? OR nis LIKE ?)"
		likeQ := "%" + search + "%"
		args = append(args, likeQ, likeQ, likeQ)
	}

	if className != "" && className != "all" {
		whereClause += " AND class_name = ?"
		args = append(args, className)
	}

	if isActiveStr != "" && isActiveStr != "all" {
		isActiveVal := 0
		if isActiveStr == "true" {
			isActiveVal = 1
		}
		whereClause += " AND is_active = ?"
		args = append(args, isActiveVal)
	}

	// 1. Data Query
	query := fmt.Sprintf(`
		SELECT id, nik, nisn, nis, full_name, gender, class_name, is_active, status, created_at
		FROM students
		WHERE %s
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	dataArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, dataArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []models.Student
	for rows.Next() {
		var s models.Student
		var nik, nisn, nis, gender, cName sql.NullString
		var isActive sql.NullInt64
		var created sql.NullTime

		err := rows.Scan(&s.ID, &nik, &nisn, &nis, &s.FullName, &gender, &cName, &isActive, &s.Status, &created)
		if err != nil {
			return nil, err
		}

		if nik.Valid { s.NIK = &nik.String }
		if nisn.Valid { s.NISN = &nisn.String }
		if nis.Valid { s.NIS = &nis.String }
		if gender.Valid { s.Gender = &gender.String }
		if cName.Valid { s.ClassName = &cName.String }
		if isActive.Valid { s.IsActive = isActive.Int64 == 1 } else { s.IsActive = false }
		if created.Valid { s.CreatedAt = &created.Time }

		students = append(students, s)
	}
	if students == nil {
		students = []models.Student{}
	}

	// 2. Total Count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM students WHERE %s", whereClause)
	var total int
	err = r.DB.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, err
	}

	// 3. Global Stats
	var globalTotal, globalActive int
	err = r.DB.QueryRow(`
		SELECT COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) 
		FROM students
	`).Scan(&globalTotal, &globalActive)
	if err != nil {
		// Log error but don't fail, stats might just be 0
		globalTotal, globalActive = 0, 0
	}

	// 4. Group by class
	byClassQuery := `
		SELECT class_name, COUNT(*) 
		FROM students 
		GROUP BY class_name 
		ORDER BY class_name
	`
	classRows, err := r.DB.Query(byClassQuery)
	if err != nil {
		return nil, err
	}
	defer classRows.Close()

	var byClass []models.StudentByClass
	for classRows.Next() {
		var bc models.StudentByClass
		var n sql.NullString
		err := classRows.Scan(&n, &bc.Count)
		if err != nil {
			return nil, err
		}
		if n.Valid { bc.ClassName = &n.String }
		byClass = append(byClass, bc)
	}
	if byClass == nil {
		byClass = []models.StudentByClass{}
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

	return &models.StudentResponse{
		Data: students,
		Pagination: models.StudentPagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages,
		},
		Summary: models.StudentSummary{
			Total:   globalTotal,
			Active:  globalActive,
			ByClass: byClass,
		},
	}, nil
}
