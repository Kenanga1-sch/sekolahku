package repository

import (
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type EmployeeRepository struct {
	DB *sql.DB
}

func NewEmployeeRepository(db *sql.DB) *EmployeeRepository {
	return &EmployeeRepository{DB: db}
}

func (r *EmployeeRepository) GetEmployees(page, limit int, search string) (*models.EmployeeResponse, error) {
	offset := (page - 1) * limit

	whereClause := "1=1"
	var args []interface{}

	if search != "" {
		whereClause += " AND (e.name LIKE ? OR e.email LIKE ? OR e.nip LIKE ? OR e.nuptk LIKE ?)"
		likeQ := "%" + search + "%"
		args = append(args, likeQ, likeQ, likeQ, likeQ)
	}

	query := fmt.Sprintf(`
		SELECT e.id, e.name, e.email, e.role, e.nip, e.nuptk, e.nik,
		       e.employment_status, e.job_type, e.join_date,
		       e.category, e.degree, e.quote, e.photo_url, e.display_order,
		       e.user_id
		FROM employee_details e
		WHERE %s
		ORDER BY e.created_at DESC
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
		e, err := scanEmployeeRow(rows)
		if err != nil {
			return nil, err
		}
		employees = append(employees, e)
	}
	if employees == nil {
		employees = []models.Employee{}
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM employee_details e WHERE %s", whereClause)
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

// scanEmployeeRow membaca satu baris SELECT kolom employee_details
// (daftar kolom sama dengan GetEmployees/GetEmployeesByIDs).
func scanEmployeeRow(rows *sql.Rows) (models.Employee, error) {
	var e models.Employee
	var name, email, role, nip, nuptk, nik, empStatus, jobType, joinDate sql.NullString
	var cat, deg, quot, photo, uId sql.NullString
	var displayOrder sql.NullInt64

	err := rows.Scan(
		&e.ID, &name, &email, &role, &nip, &nuptk, &nik,
		&empStatus, &jobType, &joinDate,
		&cat, &deg, &quot, &photo, &displayOrder,
		&uId,
	)
	if err != nil {
		return e, err
	}

	if name.Valid {
		e.Name = name.String
	}
	if email.Valid {
		e.Email = email.String
	}
	if role.Valid {
		e.Role = role.String
	}
	if nip.Valid {
		e.NIP = &nip.String
	}
	if nuptk.Valid {
		e.NUPTK = &nuptk.String
	}
	if nik.Valid {
		e.NIK = &nik.String
	}
	if empStatus.Valid {
		e.EmploymentStatus = &empStatus.String
	}
	if jobType.Valid {
		e.JobType = &jobType.String
	}
	if joinDate.Valid {
		e.JoinDate = &joinDate.String
	}
	if uId.Valid {
		e.UserID = &uId.String
		e.HasAccount = true
	}
	if cat.Valid {
		e.Category = &cat.String
	}
	if deg.Valid {
		e.Degree = &deg.String
	}
	if quot.Valid {
		e.Quote = &quot.String
	}
	if photo.Valid {
		e.PhotoUrl = &photo.String
	}
	if displayOrder.Valid {
		do := int(displayOrder.Int64)
		e.DisplayOrder = &do
	}
	e.ApplyFullName()
	return e, nil
}

// GetEmployeesByIDs mengembalikan GTK terpilih sesuai urutan ids
// (dipakai cetak kartu; pola sama dengan GetStudentsByIDs).
func (r *EmployeeRepository) GetEmployeesByIDs(ids []string) ([]models.Employee, error) {
	if len(ids) == 0 {
		return []models.Employee{}, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	orderCases := make([]string, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
		orderCases[i] = "WHEN ? THEN " + fmt.Sprint(i)
	}

	query := fmt.Sprintf(`
		SELECT e.id, e.name, e.email, e.role, e.nip, e.nuptk, e.nik,
		       e.employment_status, e.job_type, e.join_date,
		       e.category, e.degree, e.quote, e.photo_url, e.display_order,
		       e.user_id
		FROM employee_details e
		WHERE e.id IN (%s)
		ORDER BY CASE e.id %s END
	`, strings.Join(placeholders, ","), strings.Join(orderCases, " "))
	for _, id := range ids {
		args = append(args, id)
	}

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	employees := []models.Employee{}
	for rows.Next() {
		e, err := scanEmployeeRow(rows)
		if err != nil {
			return nil, err
		}
		employees = append(employees, e)
	}
	return employees, rows.Err()
}

func (r *EmployeeRepository) CreateEmployee(req models.CreateEmployeeRequest) (string, error) {
	detailId := cuid2.Generate()
	now := time.Now().UnixMilli()

	empStatus := "GTY"
	if req.EmploymentStatus != nil && *req.EmploymentStatus != "" {
		empStatus = *req.EmploymentStatus
	}
	jobType := "Guru Mapel"
	if req.JobType != nil && *req.JobType != "" {
		jobType = *req.JobType
	}
	role := req.Role
	if role == "" {
		role = "guru"
	}

	query := `
		INSERT INTO employee_details (id, name, email, role, nip, nuptk, nik, employment_status, job_type, join_date, category, degree, quote, photo_url, display_order, phone, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, detailId, req.FullName, req.Email, role, req.NIP, req.NUPTK, req.NIK, empStatus, jobType, req.JoinDate, req.Category, req.Degree, req.Quote, req.PhotoUrl, req.DisplayOrder, req.Phone, now, now)
	if err != nil {
		return "", err
	}
	return detailId, nil
}

// GetEmployeesWithoutAccount returns employees not yet linked to a user account
func (r *EmployeeRepository) GetEmployeesWithoutAccount() ([]models.Employee, error) {
	query := `
		SELECT e.id, e.name, e.email, e.role, e.nip, e.phone, e.degree
		FROM employee_details e
		WHERE e.user_id IS NULL
		ORDER BY e.name ASC
	`
	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var employees []models.Employee
	for rows.Next() {
		var e models.Employee
		var name, email, role, nip, phone, deg sql.NullString
		if err := rows.Scan(&e.ID, &name, &email, &role, &nip, &phone, &deg); err != nil {
			return nil, err
		}
		if name.Valid {
			e.Name = name.String
		}
		if email.Valid {
			e.Email = email.String
		}
		if role.Valid {
			e.Role = role.String
		}
		if nip.Valid {
			e.NIP = &nip.String
		}
		if phone.Valid {
			e.Phone = &phone.String
		}
		if deg.Valid {
			e.Degree = &deg.String
		}
		e.ApplyFullName()
		employees = append(employees, e)
	}
	if employees == nil {
		employees = []models.Employee{}
	}
	return employees, nil
}

func (r *EmployeeRepository) GetEmployeeByID(id string) (*models.Employee, error) {
	query := `
		SELECT e.id, e.name, e.email, e.role,
		       e.nip, e.nuptk, e.nik, e.employment_status, e.job_type, e.join_date,
		       e.category, e.degree, e.quote, e.photo_url, e.display_order, e.phone,
		       e.user_id
		FROM employee_details e
		WHERE e.id = ?
	`
	var e models.Employee
	var name, email, role, nip, nuptk, nik, empStatus, jobType, joinDate, phone sql.NullString
	var cat, deg, quot, photo, uId sql.NullString
	var displayOrder sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&e.ID, &name, &email, &role,
		&nip, &nuptk, &nik, &empStatus, &jobType, &joinDate,
		&cat, &deg, &quot, &photo, &displayOrder, &phone,
		&uId,
	)
	if err != nil {
		return nil, err
	}

	if name.Valid {
		e.Name = name.String
	}
	if email.Valid {
		e.Email = email.String
	}
	if role.Valid {
		e.Role = role.String
	}
	if nip.Valid {
		e.NIP = &nip.String
	}
	if nuptk.Valid {
		e.NUPTK = &nuptk.String
	}
	if nik.Valid {
		e.NIK = &nik.String
	}
	if empStatus.Valid {
		e.EmploymentStatus = &empStatus.String
	}
	if jobType.Valid {
		e.JobType = &jobType.String
	}
	if joinDate.Valid {
		e.JoinDate = &joinDate.String
	}
	if phone.Valid {
		e.Phone = &phone.String
	}
	if uId.Valid {
		e.UserID = &uId.String
		e.HasAccount = true
	}
	if cat.Valid {
		e.Category = &cat.String
	}
	if deg.Valid {
		e.Degree = &deg.String
	}
	if quot.Valid {
		e.Quote = &quot.String
	}
	if photo.Valid {
		e.PhotoUrl = &photo.String
	}
	if displayOrder.Valid {
		do := int(displayOrder.Int64)
		e.DisplayOrder = &do
	}

	e.ApplyFullName()
	return &e, nil
}

func (r *EmployeeRepository) UpdateEmployee(id string, req models.CreateEmployeeRequest) error {
	now := time.Now().UnixMilli()

	query := `
		UPDATE employee_details SET name=?, email=?, role=?, nip=?, nuptk=?, nik=?, employment_status=?, job_type=?, join_date=?, category=?, degree=?, quote=?, photo_url=?, display_order=?, phone=?, updated_at=?
		WHERE id=?
	`
	_, err := r.DB.Exec(query, req.FullName, req.Email, req.Role, req.NIP, req.NUPTK, req.NIK, req.EmploymentStatus, req.JobType, req.JoinDate, req.Category, req.Degree, req.Quote, req.PhotoUrl, req.DisplayOrder, req.Phone, now, id)
	if err != nil {
		return err
	}

	// Sinkron nama akun login terkait → users.name/full_name = "Nama, Gelar"
	// agar perubahan nama/gelar GTK langsung terlihat di semua konsumen
	// berbasis users (laporan presensi, eoffice, tabungan, dst.).
	_, syncErr := r.DB.Exec(`
		UPDATE users SET
		  name = (SELECT COALESCE(ed.name, '') ||
		                 CASE WHEN COALESCE(ed.degree, '') <> '' THEN ', ' || ed.degree ELSE '' END
		          FROM employee_details ed WHERE ed.id = ?),
		  full_name = (SELECT COALESCE(ed.name, '') ||
		                 CASE WHEN COALESCE(ed.degree, '') <> '' THEN ', ' || ed.degree ELSE '' END
		          FROM employee_details ed WHERE ed.id = ?)
		WHERE id = (SELECT user_id FROM employee_details WHERE id = ?)
	`, id, id, id)
	return syncErr
}

func (r *EmployeeRepository) DeleteEmployee(id string) error {
	// id here is the employee_details.id (detailId)
	_, err := r.DB.Exec("DELETE FROM employee_details WHERE id = ?", id)
	return err
}

func (r *EmployeeRepository) DeleteEmployeeByUserID(userID string) error {
	_, err := r.DB.Exec("DELETE FROM employee_details WHERE user_id = ?", userID)
	return err
}
