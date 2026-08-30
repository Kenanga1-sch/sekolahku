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
	r.DB.QueryRow("SELECT COUNT(*) FROM library_members WHERE is_active=1").Scan(&stats.TotalMembers)
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
		where += " AND a.status = ?"
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

// ───────── Members ─────────

func (r *LibraryRepository) GetMembers(page, perPage int, search string) ([]models.LibraryMember, int, error) {
	offset := (page - 1) * perPage
	where := "WHERE 1=1"
	args := []interface{}{}
	if search = strings.TrimSpace(search); search != "" {
		where += " AND (name LIKE ? OR qr_code LIKE ? OR id LIKE ?)"
		s := "%" + search + "%"
		args = append(args, s, s, s)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM library_members "+where, args...).Scan(&total)

	query := "SELECT id, qr_code, name, max_borrow_limit, is_active, created_at FROM library_members " + where + " ORDER BY name ASC LIMIT ? OFFSET ?"
	listArgs := append(args, perPage, offset)

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	members := make([]models.LibraryMember, 0)
	for rows.Next() {
		var m models.LibraryMember
		var qr string
		var crAt sql.NullInt64
		if err := rows.Scan(&m.ID, &qr, &m.Name, &m.MaxBorrowLimit, &m.IsActive, &crAt); err != nil {
			return nil, 0, err
		}
		m.QrCode = qr
		if crAt.Valid {
			t := ToTime(crAt)
			m.CreatedAt = &t
		}
		members = append(members, m)
	}
	return members, total, nil
}

func (r *LibraryRepository) CreateMember(m models.LibraryMember) error {
	id := cuid2.Generate()
	now := UnixMilli()
	qrCode := "LIB-" + id
	if m.QrCode != "" {
		qrCode = m.QrCode
	}
	_, err := r.DB.Exec(`
		INSERT INTO library_members (id, name, qr_code, max_borrow_limit, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, 1, ?, ?)
	`, id, m.Name, qrCode, m.MaxBorrowLimit, now, now)
	return err
}

func (r *LibraryRepository) UpdateMember(id string, input models.UpdateMemberRequest) error {
	now := UnixMilli()
	_, err := r.DB.Exec(`
		UPDATE library_members SET name=?, max_borrow_limit=?, updated_at=?
		WHERE id=?
	`, input.Name, input.MaxBorrowLimit, now, id)
	return err
}

func (r *LibraryRepository) DeleteMember(id string) error {
	_, err := r.DB.Exec("DELETE FROM library_members WHERE id = ?", id)
	return err
}

func (r *LibraryRepository) SyncFromStudents() (int, error) {
	rows, err := r.DB.Query(`
		SELECT id, nisn, full_name FROM students
		WHERE status = 'active'
		  AND nisn IS NOT NULL AND nisn != ''
		  AND nisn NOT IN (SELECT nisn FROM library_members WHERE nisn IS NOT NULL)
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	now := UnixMilli()
	for rows.Next() {
		var id, nisn, name string
		if err := rows.Scan(&id, &nisn, &name); err != nil {
			continue
		}
		memberID := cuid2.Generate()
		qrCode := "LIB-" + id
		_, err = r.DB.Exec(`
			INSERT INTO library_members (id, nisn, name, qr_code, max_borrow_limit, student_id, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, 3, ?, 1, ?, ?)
		`, memberID, nisn, name, qrCode, id, now, now)
		if err == nil {
			count++
		}
	}
	return count, nil
}

func (r *LibraryRepository) GetMemberByCode(code string) (*models.LibraryMember, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, errors.New("kode tidak boleh kosong")
	}
	var m models.LibraryMember
	var sid sql.NullString
	err := r.DB.QueryRow(`
		SELECT id, qr_code, name, COALESCE(student_id, ''), max_borrow_limit, is_active
		FROM library_members WHERE id = ? OR qr_code = ? OR nisn = ?
	`, code, code, code).Scan(&m.ID, &m.QrCode, &m.Name, &sid, &m.MaxBorrowLimit, &m.IsActive)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	m.StudentID = optionalString(sid)
	return &m, nil
}
