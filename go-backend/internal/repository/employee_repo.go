package repository

import (
	"database/sql"
	"fmt"
	"math"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type EmployeeRepository struct {
	DB *sql.DB
}

func NewEmployeeRepository(db *sql.DB) *EmployeeRepository {
	return &EmployeeRepository{DB: db}
}

func (r *EmployeeRepository) GetEmployees(page, limit int, search string) (*models.EmployeeResponse, error) {
	offset := (page - 1) * limit

	whereClause := "u.role IN ('guru', 'admin', 'staff')"
	var args []interface{}

	if search != "" {
		whereClause += " AND (u.name LIKE ? OR u.email LIKE ? OR e.nip LIKE ? OR e.nuptk LIKE ?)"
		likeQ := "%" + search + "%"
		args = append(args, likeQ, likeQ, likeQ, likeQ)
	}

	// 1. Data Query
	query := fmt.Sprintf(`
		SELECT u.id, u.name, u.full_name, u.email, u.role, 
		       e.nip, e.nuptk, e.employment_status, e.job_type, e.user_id
		FROM users u
		LEFT JOIN employee_details e ON u.id = e.user_id
		WHERE %s
		ORDER BY u.created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	dataArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, dataArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var employees []models.Employee
	for rows.Next() {
		var e models.Employee
		var fn, nip, nuptk, empStatus, jobType, uId sql.NullString

		err := rows.Scan(
			&e.ID, &e.Name, &fn, &e.Email, &e.Role,
			&nip, &nuptk, &empStatus, &jobType, &uId,
		)
		if err != nil {
			return nil, err
		}

		if fn.Valid { e.FullName = &fn.String }
		if nip.Valid { e.NIP = &nip.String }
		if nuptk.Valid { e.NUPTK = &nuptk.String }
		if empStatus.Valid { e.EmploymentStatus = &empStatus.String }
		if jobType.Valid { e.JobType = &jobType.String }
		if uId.Valid { e.UserID = &uId.String }

		employees = append(employees, e)
	}
	if employees == nil {
		employees = []models.Employee{}
	}

	// 2. Count Query
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM users u
		LEFT JOIN employee_details e ON u.id = e.user_id
		WHERE %s
	`, whereClause)

	var total int
	err = r.DB.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

	return &models.EmployeeResponse{
		Data: employees,
		Pagination: models.EmployeePagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages,
		},
	}, nil
}

func (r *EmployeeRepository) CreateEmployee(req models.CreateEmployeeRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Hash Default Password
	hash, err := bcrypt.GenerateFromPassword([]byte("123456"), 10)
	if err != nil {
		return err
	}

	// 2. Insert User
	userId := cuid2.Generate()
	now := time.Now()

	userQuery := `
		INSERT INTO users (id, name, full_name, email, role, phone, password_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = tx.Exec(userQuery, userId, req.FullName, req.FullName, req.Email, req.Role, req.Phone, string(hash), now, now)
	if err != nil {
		return err // Could be UNIQUE constraint violation
	}

	// 3. Insert Employee Detail
	detailId := cuid2.Generate()
	empStatus := "GTY"
	if req.EmploymentStatus != nil && *req.EmploymentStatus != "" {
		empStatus = *req.EmploymentStatus
	}
	jobType := "Guru Mapel"
	if req.JobType != nil && *req.JobType != "" {
		jobType = *req.JobType
	}

	detailQuery := `
		INSERT INTO employee_details (id, user_id, nip, nuptk, nik, employment_status, job_type, join_date, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = tx.Exec(detailQuery, detailId, userId, req.NIP, req.NUPTK, req.NIK, empStatus, jobType, req.JoinDate, now, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *EmployeeRepository) GetEmployeeByID(id string) (*models.Employee, error) {
	query := `
		SELECT u.id, u.name, u.full_name, u.email, u.role, u.phone,
		       e.nip, e.nuptk, e.nik, e.employment_status, e.job_type, e.join_date
		FROM users u
		LEFT JOIN employee_details e ON u.id = e.user_id
		WHERE u.id = ?
	`
	var e models.Employee
	var fn, phone, nip, nuptk, nik, empStatus, jobType, joinDate sql.NullString

	err := r.DB.QueryRow(query, id).Scan(
		&e.ID, &e.Name, &fn, &e.Email, &e.Role, &phone,
		&nip, &nuptk, &nik, &empStatus, &jobType, &joinDate,
	)
	if err != nil {
		return nil, err
	}

	if fn.Valid { e.FullName = &fn.String }
	if phone.Valid { e.Phone = &phone.String }
	if nip.Valid { e.NIP = &nip.String }
	if nuptk.Valid { e.NUPTK = &nuptk.String }
	if nik.Valid { e.NIK = &nik.String }
	if empStatus.Valid { e.EmploymentStatus = &empStatus.String }
	if jobType.Valid { e.JobType = &jobType.String }
	if joinDate.Valid { e.JoinDate = &joinDate.String }

	return &e, nil
}

func (r *EmployeeRepository) UpdateEmployee(id string, req models.CreateEmployeeRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now()

	// 1. Update User
	userQuery := `
		UPDATE users SET name=?, full_name=?, email=?, role=?, phone=?, updated_at=?
		WHERE id=?
	`
	_, err = tx.Exec(userQuery, req.FullName, req.FullName, req.Email, req.Role, req.Phone, now, id)
	if err != nil {
		return err
	}

	// 2. Update/Insert Employee Detail
	// Check if detail exists
	var detailExists bool
	r.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM employee_details WHERE user_id=?)", id).Scan(&detailExists)

	if detailExists {
		detailQuery := `
			UPDATE employee_details SET nip=?, nuptk=?, nik=?, employment_status=?, job_type=?, join_date=?, updated_at=?
			WHERE user_id=?
		`
		_, err = tx.Exec(detailQuery, req.NIP, req.NUPTK, req.NIK, req.EmploymentStatus, req.JobType, req.JoinDate, now, id)
	} else {
		detailId := cuid2.Generate()
		detailQuery := `
			INSERT INTO employee_details (id, user_id, nip, nuptk, nik, employment_status, job_type, join_date, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
		_, err = tx.Exec(detailQuery, detailId, id, req.NIP, req.NUPTK, req.NIK, req.EmploymentStatus, req.JobType, req.JoinDate, now, now)
	}

	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *EmployeeRepository) DeleteEmployee(id string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Order matters: delete child first or rely on cascade if any
	_, err = tx.Exec("DELETE FROM employee_details WHERE user_id = ?", id)
	if err != nil {
		return err
	}

	_, err = tx.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		return err
	}

	return tx.Commit()
}
