package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type LibraryRepository struct {
	DB *sql.DB
}

func NewLibraryRepository(db *sql.DB) *LibraryRepository {
	return &LibraryRepository{DB: db}
}

// ───────── Stats & Books ─────────

func (r *LibraryRepository) GetStats() (*models.LibraryStats, error) {
	stats := &models.LibraryStats{}

	r.DB.QueryRow("SELECT COUNT(*) FROM library_assets WHERE status='AVAILABLE'").Scan(&stats.AvailableBooks)
	r.DB.QueryRow("SELECT COUNT(*) FROM library_assets WHERE status='BORROWED'").Scan(&stats.BorrowedBooks)
	r.DB.QueryRow(`
		SELECT COUNT(*) FROM library_members m
		WHERE m.is_active=1 AND (
			m.user_id IS NOT NULL
			OR EXISTS (SELECT 1 FROM students st WHERE st.id = m.student_id AND (st.status='active' OR st.is_active=1))
		)
	`).Scan(&stats.TotalMembers)
	r.DB.QueryRow("SELECT COUNT(*) FROM library_loans WHERE is_returned=0").Scan(&stats.ActiveLoans)

	var totalBooks int
	r.DB.QueryRow("SELECT COUNT(*) FROM library_catalog").Scan(&totalBooks)
	stats.TotalBooks = totalBooks

	var overdueCount int
	r.DB.QueryRow(`
		SELECT COUNT(*)
		FROM library_loans WHERE is_returned=0 AND due_date < ?
	`, time.Now().UnixMilli()).Scan(&overdueCount)
	stats.OverdueLoans = overdueCount

	var todayVisits int
	r.DB.QueryRow("SELECT COUNT(*) FROM library_visits WHERE DATE(created_at / 1000, 'unixepoch') = DATE('now')").Scan(&todayVisits)
	stats.TodayVisits = todayVisits

	return stats, nil
}

func (r *LibraryRepository) GetBooks(page, perPage int, search, category, statusFilter string) ([]models.BookDetail, int, error) {
	offset := (page - 1) * perPage
	where := "WHERE 1=1"
	args := []interface{}{}

	search = strings.TrimSpace(search)
	if search != "" {
		where += " AND (c.title LIKE ? OR c.author LIKE ? OR c.isbn LIKE ? OR a.id LIKE ?)"
		like := "%" + search + "%"
		args = append(args, like, like, like, like)
	}
	if category = strings.TrimSpace(category); category != "" && category != "all" {
		where += " AND c.category = ?"
		args = append(args, category)
	}
	if statusFilter = strings.TrimSpace(statusFilter); statusFilter != "" {
		where += " AND UPPER(a.status) = UPPER(?)"
		args = append(args, statusFilter)
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM library_assets a JOIN library_catalog c ON a.catalog_id = c.id " + where
	r.DB.QueryRow(countQuery, args...).Scan(&total)

	query := `
		SELECT a.id, a.catalog_id, c.title, c.author, c.isbn, a.status, a.location, a.condition,
		       c.publisher, c.year, c.category
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		` + where + ` ORDER BY c.title ASC LIMIT ? OFFSET ?`
	listArgs := append(args, perPage, offset)

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var books []models.BookDetail
	for rows.Next() {
		var b models.BookDetail
		var loc, cond, pub sql.NullString
		var yr sql.NullInt64
		var cat string
		if err := rows.Scan(&b.ID, &b.CatalogID, &b.Title, &b.Author, &b.ISBN, &b.Status, &loc, &cond, &pub, &yr, &cat); err != nil {
			return nil, 0, err
		}
		b.Category = cat
		if loc.Valid { b.Location = loc.String }
		if cond.Valid { b.Condition = cond.String }
		if pub.Valid { b.Publisher = pub.String }
		books = append(books, b)
	}
	if books == nil {
		books = []models.BookDetail{}
	}
	return books, total, nil
}

func (r *LibraryRepository) CreateBook(input models.CreateBookRequest) error {
	id := cuid2.Generate()
	now := UnixMilli()
	title := strings.TrimSpace(input.Title)
	author := strings.TrimSpace(input.Author)
	isbn := strings.TrimSpace(input.ISBN)
	if title == "" || author == "" {
		return errors.New("judul dan penulis wajib diisi")
	}
	category := strings.TrimSpace(input.Category)
	if category == "" {
		category = "Uncategorized"
	}

	catalogID := cuid2.Generate()
	_, err := r.DB.Exec(`
		INSERT INTO library_catalog (id, isbn, title, author, publisher, year, category, description, cover, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, catalogID, isbn, title, author, input.Publisher, input.Year, category, input.Description, input.Cover, now, now)
	if err != nil {
		return err
	}

	for i := 0; i < input.Copies; i++ {
		assetID := id
		if i > 0 {
			assetID = id + fmt.Sprintf("-%d", i+1)
		}
		_, err = r.DB.Exec(`
			INSERT INTO library_assets (id, catalog_id, status, location, condition, created_at, updated_at)
			VALUES (?, ?, 'AVAILABLE', ?, 'Baik', ?, ?)
		`, assetID, catalogID, input.Location, now, now)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *LibraryRepository) UpdateBook(id string, input models.UpdateBookRequest) error {
	now := UnixMilli()
	var catalogID string
	err := r.DB.QueryRow("SELECT catalog_id FROM library_assets WHERE id = ?", id).Scan(&catalogID)
	if err != nil {
		return err
	}
	_, err = r.DB.Exec(`
		UPDATE library_catalog SET isbn=?, title=?, author=?, publisher=?, year=?, category=?, description=?, updated_at=?
		WHERE id=?
	`, input.ISBN, input.Title, input.Author, input.Publisher, input.Year, input.Category, input.Description, now, catalogID)
	if err != nil {
		return err
	}
	_, err = r.DB.Exec("UPDATE library_assets SET location=?, updated_at=? WHERE id=?",
		input.Location, now, id)
	return err
}

func (r *LibraryRepository) DeleteBook(id string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var catalogID string
	err = tx.QueryRow("SELECT catalog_id FROM library_assets WHERE id = ?", id).Scan(&catalogID)
	if err != nil {
		return err
	}

	var catalogRefCount int
	tx.QueryRow("SELECT COUNT(*) FROM library_assets WHERE catalog_id = ? AND id != ?", catalogID, id).Scan(&catalogRefCount)

	_, err = tx.Exec("DELETE FROM library_assets WHERE id = ?", id)
	if err != nil {
		return err
	}

	if catalogRefCount == 0 {
		tx.Exec("DELETE FROM library_catalog WHERE id = ?", catalogID)
	}

	return tx.Commit()
}

// ───────── Members (single source: students for student members, users for staff) ─────────

// memberBaseQuery resolves member identity via JOIN: students for student members,
// users for staff members. No denormalized name/class/qr anymore.
const memberBaseQuery = `
	SELECT m.id, m.student_id, m.user_id, m.max_borrow_limit, m.is_active, m.created_at,
	       COALESCE(st.full_name, u.name, '') as display_name,
	       COALESCE(st.class_name, '') as class_name,
	       COALESCE(st.qr_code, '') as qr_code,
	       COALESCE(st.photo, u.image, '') as photo
	FROM library_members m
	LEFT JOIN students st ON m.student_id = st.id
	LEFT JOIN users u ON m.user_id = u.id
`

func scanMember(scanner interface{ Scan(dest ...interface{}) error }) (*models.LibraryMember, error) {
	var m models.LibraryMember
	var stID, uID sql.NullString
	var qrCode, photo, className sql.NullString
	var crAt sql.NullInt64

	err := scanner.Scan(&m.ID, &stID, &uID, &m.MaxBorrowLimit, &m.IsActive, &crAt,
		&m.Name, &className, &qrCode, &photo)
	if err != nil {
		return nil, err
	}
	if stID.Valid { m.StudentID = &stID.String }
	if uID.Valid { m.UserID = &uID.String }
	if className.Valid && className.String != "" {
		m.ClassName = &className.String
	}
	m.QrCode = qrCode.String
	if photo.Valid && photo.String != "" {
		m.Photo = &photo.String
	}
	if crAt.Valid {
		t := ToTime(crAt)
		m.CreatedAt = &t
	}
	return &m, nil
}

func (r *LibraryRepository) GetMembers(page, perPage int, search string) ([]models.LibraryMember, int, error) {
	offset := (page - 1) * perPage
	where := "WHERE 1=1"
	args := []interface{}{}
	if search = strings.TrimSpace(search); search != "" {
		where += " AND (COALESCE(st.full_name, u.name, '') LIKE ? OR COALESCE(st.qr_code,'') LIKE ? OR m.id LIKE ? OR COALESCE(st.nisn,'') LIKE ? OR COALESCE(st.class_name,'') LIKE ?)"
		s := "%" + search + "%"
		args = append(args, s, s, s, s, s)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM library_members m LEFT JOIN students st ON m.student_id = st.id LEFT JOIN users u ON m.user_id = u.id "+where, args...).Scan(&total)

	query := memberBaseQuery + where + " ORDER BY display_name ASC LIMIT ? OFFSET ?"
	listArgs := append(args, perPage, offset)

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	members := make([]models.LibraryMember, 0)
	for rows.Next() {
		m, err := scanMember(rows)
		if err != nil {
			return nil, 0, err
		}
		members = append(members, *m)
	}
	return members, total, nil
}

// CreateMember creates a staff/guest member (student members are auto-created
// from students by EnsureMember / SyncFromStudents)
func (r *LibraryRepository) CreateMember(m models.LibraryMember) error {
	id := cuid2.Generate()
	now := UnixMilli()
	if m.StudentID != nil && *m.StudentID != "" {
		// Student member: only module-owned data (max_borrow_limit)
		_, err := r.DB.Exec(`
			INSERT INTO library_members (id, student_id, max_borrow_limit, is_active, created_at, updated_at)
			VALUES (?, ?, ?, 1, ?, ?)
		`, id, *m.StudentID, m.MaxBorrowLimit, now, now)
		return err
	}
	if m.UserID != nil && *m.UserID != "" {
		_, err := r.DB.Exec(`
			INSERT INTO library_members (id, user_id, max_borrow_limit, is_active, created_at, updated_at)
			VALUES (?, ?, ?, 1, ?, ?)
		`, id, *m.UserID, m.MaxBorrowLimit, now, now)
		return err
	}
	return errors.New("member siswa/guru wajib dipilih")
}

// UpdateMember only updates module-owned data (max_borrow_limit)
func (r *LibraryRepository) UpdateMember(id string, input models.UpdateMemberRequest) error {
	now := UnixMilli()
	_, err := r.DB.Exec(`
		UPDATE library_members SET max_borrow_limit=?, updated_at=?
		WHERE id=?
	`, input.MaxBorrowLimit, now, id)
	return err
}

func (r *LibraryRepository) DeleteMember(id string) error {
	_, err := r.DB.Exec("DELETE FROM library_members WHERE id = ?", id)
	return err
}

// EnsureMember creates a library extension row for an active student if missing
func (r *LibraryRepository) EnsureMember(studentID string) error {
	_, err := r.DB.Exec(`
		INSERT INTO library_members (id, student_id, max_borrow_limit, is_active, created_at, updated_at)
		SELECT 'lib_' || s.id, s.id, 3, 1, ?, ?
		FROM students s
		WHERE s.id = ? AND (s.status = 'active' OR s.is_active = 1)
		  AND NOT EXISTS (SELECT 1 FROM library_members lm WHERE lm.student_id = s.id)
	`, UnixMilli(), UnixMilli(), studentID)
	return err
}

// SyncFromStudents ensures every active student has a library member row.
// Identity is JOINed at query time, so this is the only sync needed.
func (r *LibraryRepository) SyncFromStudents() (int, error) {
	res, err := r.DB.Exec(`
		INSERT INTO library_members (id, student_id, max_borrow_limit, is_active, created_at, updated_at)
		SELECT 'lib_' || s.id, s.id, 3, 1, ?, ?
		FROM students s
		WHERE (s.status = 'active' OR s.is_active = 1)
		  AND NOT EXISTS (SELECT 1 FROM library_members lm WHERE lm.student_id = s.id)
	`, UnixMilli(), UnixMilli())
	if err != nil {
		return 0, err
	}
	count, _ := res.RowsAffected()
	return int(count), nil
}

// GetMemberByCode resolves a member by QR/NISN/NIS/student-id (student) or member id
func (r *LibraryRepository) GetMemberByCode(code string) (*models.LibraryMember, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, errors.New("kode tidak boleh kosong")
	}
	// Try student-sourced lookup first (qr_code / nisn / nis / student_id)
	query := memberBaseQuery + `
		WHERE m.student_id = (
			SELECT id FROM students
			WHERE qr_code = ? OR nisn = ? OR nis = ? OR id = ?
			LIMIT 1
		)
	`
	m, err := scanMember(r.DB.QueryRow(query, code, code, code, code))
	if err == nil {
		return m, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	// Fallback: member id direct (staff members)
	m, err = scanMember(r.DB.QueryRow(memberBaseQuery+" WHERE m.id = ?", code))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return m, nil
}
