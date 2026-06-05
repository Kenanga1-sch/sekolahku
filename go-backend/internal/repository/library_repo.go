package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strconv"
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

// Stats
func (r *LibraryRepository) GetStats() (*models.LibraryStats, error) {
	stats := &models.LibraryStats{}

	// Total and status breakdown from library_assets
	err := r.DB.QueryRow("SELECT COUNT(*) FROM library_assets").Scan(&stats.TotalBooks)
	if err != nil {
		return nil, err
	}
	err = r.DB.QueryRow("SELECT COUNT(*) FROM library_assets WHERE status = 'AVAILABLE'").Scan(&stats.AvailableBooks)
	if err != nil {
		return nil, err
	}
	err = r.DB.QueryRow("SELECT COUNT(*) FROM library_assets WHERE status = 'BORROWED'").Scan(&stats.BorrowedBooks)
	if err != nil {
		return nil, err
	}

	// Total members
	err = r.DB.QueryRow("SELECT COUNT(*) FROM library_members WHERE is_active = 1").Scan(&stats.TotalMembers)
	if err != nil {
		return nil, err
	}

	// Active and overdue loans
	err = r.DB.QueryRow("SELECT COUNT(*) FROM library_loans WHERE is_returned = 0").Scan(&stats.ActiveLoans)
	if err != nil {
		return nil, err
	}

	now := UnixMilli()
	err = r.DB.QueryRow("SELECT COUNT(*) FROM library_loans WHERE is_returned = 0 AND due_date < ?", now).Scan(&stats.OverdueLoans)
	if err != nil {
		return nil, err
	}

	// Today visits
	today := time.Now().Format("2006-01-02")
	err = r.DB.QueryRow("SELECT COUNT(*) FROM library_visits WHERE date = ?", today).Scan(&stats.TodayVisits)
	if err != nil {
		// If table doesn't exist yet or other error, just set 0
		stats.TodayVisits = 0
	}

	return stats, nil
}

// Books / Assets
func (r *LibraryRepository) GetBooks(page, perPage int, search, category string) ([]map[string]interface{}, int, error) {
	offset := (page - 1) * perPage
	query := `
		SELECT 
			a.id, a.catalog_id, a.status, a.location, a.condition, a.created_at, a.updated_at,
			c.title, c.author, c.isbn, c.publisher, c.year, c.category, c.description, c.cover
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE 1=1
	`
	args := []interface{}{}

	if search != "" {
		query += " AND (c.title LIKE ? OR c.author LIKE ? OR c.isbn LIKE ? OR a.id LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern, pattern)
	}

	if category != "" && category != "all" {
		query += " AND c.category = ?"
		args = append(args, category)
	}

	// Get total count
	countQuery := "SELECT COUNT(*) FROM (" + query + ")"
	var totalItems int
	err := r.DB.QueryRow(countQuery, args...).Scan(&totalItems)
	if err != nil {
		return nil, 0, err
	}

	// Get items
	query += " ORDER BY c.title ASC LIMIT ? OFFSET ?"
	args = append(args, perPage, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		var a models.LibraryAsset
		var c models.LibraryCatalog
		var asAt, asUp sql.NullInt64
		var isbn, author, publisher, cDesc, cCover, aLoc, aCond sql.NullString
		var cYear sql.NullInt64

		err := rows.Scan(
			&a.ID, &a.CatalogID, &a.Status, &aLoc, &aCond, &asAt, &asUp,
			&c.Title, &author, &isbn, &publisher, &cYear, &c.Category, &cDesc, &cCover,
		)
		if err != nil {
			return nil, 0, err
		}

		item := map[string]interface{}{
			"id":        a.ID,
			"catalogId": a.CatalogID,
			"status":    a.Status,
			"location":  aLoc.String,
			"condition": aCond.String,
			"createdAt": ToTime(asAt),
			"updatedAt": ToTime(asUp),
			"title":     c.Title,
			"author":    author.String,
			"isbn":      isbn.String,
			"publisher": publisher.String,
			"year":      cYear.Int64,
			"category":  c.Category,
			"catalog": map[string]interface{}{
				"id":          a.CatalogID,
				"title":       c.Title,
				"author":      author.String,
				"isbn":        isbn.String,
				"publisher":   publisher.String,
				"year":        cYear.Int64,
				"category":    c.Category,
				"description": cDesc.String,
				"cover":       cCover.String,
			},
		}
		results = append(results, item)
	}

	return results, totalItems, nil
}

func (r *LibraryRepository) CreateBook(input map[string]interface{}) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := UnixMilli()
	catalogId := cuid2.Generate()
	assetId := cuid2.Generate() // Default asset for the new catalog entry

	// Insert Catalog
	_, err = tx.Exec(`
		INSERT INTO library_catalog (id, isbn, title, author, publisher, year, category, description, cover, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, catalogId, input["isbn"], input["title"], input["author"], input["publisher"], input["year"], input["category"], input["description"], input["cover"], now, now)
	if err != nil {
		// Try to find existing catalog by ISBN if it fails due to unique constraint
		if strings.Contains(err.Error(), "UNIQUE") && input["isbn"] != "" {
			err = tx.QueryRow("SELECT id FROM library_catalog WHERE isbn = ?", input["isbn"]).Scan(&catalogId)
			if err != nil {
				return err
			}
		} else {
			return err
		}
	}

	// Insert Asset
	_, err = tx.Exec(`
		INSERT INTO library_assets (id, catalog_id, status, location, condition, created_at, updated_at)
		VALUES (?, ?, 'AVAILABLE', ?, 'Baik', ?, ?)
	`, assetId, catalogId, input["location"], now, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *LibraryRepository) UpdateBook(id string, input map[string]interface{}) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := UnixMilli()

	// 1. Get catalog_id from asset
	var catalogId string
	err = tx.QueryRow("SELECT catalog_id FROM library_assets WHERE id = ?", id).Scan(&catalogId)
	if err != nil {
		return err
	}

	// 2. Update Catalog
	_, err = tx.Exec(`
		UPDATE library_catalog 
		SET title = ?, author = ?, isbn = ?, publisher = ?, year = ?, category = ?, description = ?, updated_at = ?
		WHERE id = ?
	`, input["title"], input["author"], input["isbn"], input["publisher"], input["year"], input["category"], input["description"], now, catalogId)
	if err != nil {
		return err
	}

	// 3. Update Asset
	_, err = tx.Exec(`
		UPDATE library_assets SET location = ?, updated_at = ? WHERE id = ?
	`, input["location"], now, id)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *LibraryRepository) DeleteBook(id string) error {
	// For simplicity, we only delete the asset.
	// The catalog entry might stay if other assets use it (though in this app they usually 1:1)
	_, err := r.DB.Exec("DELETE FROM library_assets WHERE id = ?", id)
	return err
}

func (r *LibraryRepository) SwapQR(oldId, newId string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Check if newId exists
	var exists int
	tx.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = ?", newId).Scan(&exists)
	if exists > 0 {
		return errors.New("new QR Code already registered")
	}

	// 2. Update Asset ID (this is tricky in SQLite if PK, we might need to delete and insert)
	// Actually, updating PK is allowed in SQLite if no FK constraints block it.
	// But library_loans has FK to library_assets(id).

	// Create temporary record or use a simple Update if PRAGMA foreign_keys = OFF
	// Best way: Update asset ID and rely on ON UPDATE CASCADE if it was defined.
	// The schema I saw: FOREIGN KEY (`item_id`) REFERENCES `library_assets`(`id`) ON UPDATE no action ON DELETE no action
	// So ON UPDATE NO ACTION. We must manually update loans.

	_, err = tx.Exec("UPDATE library_assets SET id = ? WHERE id = ?", newId, oldId)
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE library_loans SET item_id = ? WHERE item_id = ?", newId, oldId)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// Members
func (r *LibraryRepository) GetMembers(page, perPage int, search string) ([]models.LibraryMember, int, error) {
	offset := (page - 1) * perPage
	query := "SELECT id, user_id, student_id, name, class_name, qr_code, max_borrow_limit, photo, is_active, created_at, updated_at FROM library_members WHERE 1=1"
	args := []interface{}{}

	if search != "" {
		query += " AND (name LIKE ? OR class_name LIKE ? OR student_id LIKE ? OR qr_code LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern, pattern)
	}

	var totalItems int
	countQuery := "SELECT COUNT(*) FROM (" + query + ")"
	err := r.DB.QueryRow(countQuery, args...).Scan(&totalItems)
	if err != nil {
		return nil, 0, err
	}

	query += " ORDER BY name ASC LIMIT ? OFFSET ?"
	args = append(args, perPage, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	members := make([]models.LibraryMember, 0)
	for rows.Next() {
		var m models.LibraryMember
		var crAt, upAt sql.NullInt64
		var uId, sId, cName, photo sql.NullString
		var isActive int

		err := rows.Scan(&m.ID, &uId, &sId, &m.Name, &cName, &m.QrCode, &m.MaxBorrowLimit, &photo, &isActive, &crAt, &upAt)
		if err != nil {
			return nil, 0, err
		}

		m.UserID = Ptr(uId.String)
		m.StudentID = Ptr(sId.String)
		m.ClassName = Ptr(cName.String)
		m.Photo = Ptr(photo.String)
		m.IsActive = isActive == 1
		m.CreatedAt = Ptr(ToTime(crAt))
		m.UpdatedAt = Ptr(ToTime(upAt))

		members = append(members, m)
	}

	return members, totalItems, nil
}

func (r *LibraryRepository) CreateMember(m models.LibraryMember) error {
	now := UnixMilli()
	if m.ID == "" {
		m.ID = cuid2.Generate()
	}
	if m.QrCode == "" {
		m.QrCode = m.ID // Default to ID if not provided
	}

	_, err := r.DB.Exec(`
		INSERT INTO library_members (id, user_id, student_id, name, class_name, qr_code, max_borrow_limit, photo, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, m.ID, m.UserID, m.StudentID, m.Name, m.ClassName, m.QrCode, m.MaxBorrowLimit, m.Photo, 1, now, now)
	return err
}

func (r *LibraryRepository) UpdateMember(id string, input map[string]interface{}) error {
	now := UnixMilli()
	_, err := r.DB.Exec(`
		UPDATE library_members 
		SET name = ?, class_name = ?, student_id = ?, max_borrow_limit = ?, updated_at = ?
		WHERE id = ?
	`, input["name"], input["className"], input["studentId"], input["maxBorrowLimit"], now, id)
	return err
}

func (r *LibraryRepository) DeleteMember(id string) error {
	_, err := r.DB.Exec("DELETE FROM library_members WHERE id = ?", id)
	return err
}

func (r *LibraryRepository) SyncFromStudents() (int, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	// Get active students NOT in library_members.
	// Use a CASE statement to fallback to student's ID if qr_code is empty string or NULL, avoiding unique constraint violations.
	rows, err := tx.Query(`
		SELECT id, full_name, COALESCE(class_name, ''), 
		       CASE WHEN qr_code IS NOT NULL AND TRIM(qr_code) != '' THEN qr_code ELSE id END
		FROM students
		WHERE (is_active = 1 OR status = 'active' OR status = 'aktif')
			AND id NOT IN (SELECT student_id FROM library_members WHERE student_id IS NOT NULL)
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type stubStudent struct {
		ID    string
		Name  string
		Class string
		QR    string
	}
	var newMembers []stubStudent
	for rows.Next() {
		var s stubStudent
		rows.Scan(&s.ID, &s.Name, &s.Class, &s.QR)
		newMembers = append(newMembers, s)
	}
	rows.Close()

	now := UnixMilli()
	count := 0
	for _, s := range newMembers {
		id := cuid2.Generate()
		_, err = tx.Exec(`
			INSERT INTO library_members (id, student_id, name, class_name, qr_code, max_borrow_limit, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 3, 1, ?, ?)
		`, id, s.ID, s.Name, s.Class, s.QR, now, now)
		if err != nil {
			fmt.Printf("[SyncFromStudents] Warning: failed to sync student %s (%s), error: %v\n", s.Name, s.ID, err)
		} else {
			count++
		}
	}

	return count, tx.Commit()
}

// Loans
func (r *LibraryRepository) GetLoans(loanType string) ([]map[string]interface{}, error) {
	query := `
		SELECT 
			l.id, l.member_id, l.item_id, l.borrow_date, l.due_date, l.return_date, l.is_returned, l.fine_amount,
			m.name as member_name, m.class_name as member_class,
			c.title as item_title
		FROM library_loans l
		JOIN library_members m ON l.member_id = m.id
		JOIN library_assets a ON l.item_id = a.id
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE 1=1
	`
	args := []interface{}{}

	switch loanType {
	case "active":
		query += " AND l.is_returned = 0"
	case "overdue":
		now := UnixMilli()
		query += " AND l.is_returned = 0 AND l.due_date < ?"
		args = append(args, now)
	}

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		var l models.LibraryLoan
		var brAt, duAt, reAt sql.NullInt64
		var mName, mClass, iTitle sql.NullString
		var isRet int

		err := rows.Scan(
			&l.ID, &l.MemberID, &l.ItemID, &brAt, &duAt, &reAt, &isRet, &l.FineAmount,
			&mName, &mClass, &iTitle,
		)
		if err != nil {
			return nil, err
		}

		res := map[string]interface{}{
			"id":         l.ID,
			"memberId":   l.MemberID,
			"itemId":     l.ItemID,
			"borrowDate": ToTime(brAt),
			"dueDate":    ToTime(duAt),
			"isReturned": isRet == 1,
			"fineAmount": l.FineAmount,
			"member": map[string]interface{}{
				"name":      mName.String,
				"className": mClass.String,
			},
			"item": map[string]interface{}{
				"id": l.ItemID,
				"catalog": map[string]interface{}{
					"title": iTitle.String,
				},
			},
		}
		if reAt.Valid {
			res["returnDate"] = ToTime(reAt)
		} else {
			res["returnDate"] = nil
		}
		results = append(results, res)
	}

	return results, nil
}

func (r *LibraryRepository) GetMemberByCode(code string) (*models.LibraryMember, error) {
	var m models.LibraryMember
	var userID, studentID, className, photo sql.NullString
	var createdAt, updatedAt sql.NullInt64
	var isActive int

	err := r.DB.QueryRow(`
		SELECT id, user_id, student_id, name, class_name, qr_code, max_borrow_limit, photo, is_active, created_at, updated_at
		FROM library_members
		WHERE is_active = 1 AND (id = ? OR qr_code = ? OR student_id = ?)
		LIMIT 1
	`, code, code, code).Scan(
		&m.ID, &userID, &studentID, &m.Name, &className, &m.QrCode, &m.MaxBorrowLimit, &photo, &isActive, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	if userID.Valid {
		m.UserID = &userID.String
	}
	if studentID.Valid {
		m.StudentID = &studentID.String
	}
	if className.Valid {
		m.ClassName = &className.String
	}
	if photo.Valid {
		m.Photo = &photo.String
	}
	m.IsActive = isActive == 1
	if createdAt.Valid {
		t := ToTime(createdAt)
		m.CreatedAt = &t
	}
	if updatedAt.Valid {
		t := ToTime(updatedAt)
		m.UpdatedAt = &t
	}

	return &m, nil
}

func (r *LibraryRepository) GetAssetByCode(code string) (map[string]interface{}, error) {
	var assetID, catalogID, status, title, category string
	var location, condition, author, isbn, publisher, description, cover sql.NullString
	var year, createdAt, updatedAt sql.NullInt64

	err := r.DB.QueryRow(`
		SELECT
			a.id, a.catalog_id, a.status, a.location, a.condition, a.created_at, a.updated_at,
			c.title, c.author, c.isbn, c.publisher, c.year, c.category, c.description, c.cover
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE a.id = ? OR c.isbn = ?
		LIMIT 1
	`, code, code).Scan(
		&assetID, &catalogID, &status, &location, &condition, &createdAt, &updatedAt,
		&title, &author, &isbn, &publisher, &year, &category, &description, &cover,
	)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"id":          assetID,
		"catalogId":   catalogID,
		"status":      status,
		"location":    location.String,
		"condition":   condition.String,
		"createdAt":   ToTime(createdAt),
		"updatedAt":   ToTime(updatedAt),
		"title":       title,
		"author":      author.String,
		"isbn":        isbn.String,
		"publisher":   publisher.String,
		"year":        year.Int64,
		"category":    category,
		"description": description.String,
		"cover":       cover.String,
		"catalog": map[string]interface{}{
			"id":          catalogID,
			"title":       title,
			"author":      author.String,
			"isbn":        isbn.String,
			"publisher":   publisher.String,
			"year":        year.Int64,
			"category":    category,
			"description": description.String,
			"cover":       cover.String,
		},
	}, nil
}

func (r *LibraryRepository) HasVisitedToday(memberID string) (bool, error) {
	var count int
	err := r.DB.QueryRow(`
		SELECT COUNT(*)
		FROM library_visits
		WHERE member_id = ? AND date = ?
	`, memberID, time.Now().Format("2006-01-02")).Scan(&count)
	return count > 0, err
}

func (r *LibraryRepository) GetActiveLoansByMemberID(memberID string) ([]map[string]interface{}, error) {
	query := `
		SELECT
			l.id, l.member_id, l.item_id, l.borrow_date, l.due_date, l.return_date, l.is_returned, l.fine_amount,
			m.name, m.class_name,
			c.title, c.category
		FROM library_loans l
		JOIN library_members m ON l.member_id = m.id
		JOIN library_assets a ON l.item_id = a.id
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE l.member_id = ? AND l.is_returned = 0
		ORDER BY l.borrow_date DESC
	`
	rows, err := r.DB.Query(query, memberID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, mID, itemID, memberName, itemTitle, category string
		var memberClass sql.NullString
		var borrowDate, dueDate, returnDate sql.NullInt64
		var isReturned int
		var fineAmount int

		if err := rows.Scan(&id, &mID, &itemID, &borrowDate, &dueDate, &returnDate, &isReturned, &fineAmount, &memberName, &memberClass, &itemTitle, &category); err != nil {
			return nil, err
		}

		loan := map[string]interface{}{
			"id":         id,
			"memberId":   mID,
			"itemId":     itemID,
			"borrowDate": ToTime(borrowDate),
			"dueDate":    ToTime(dueDate),
			"returnDate": nil,
			"isReturned": isReturned == 1,
			"fineAmount": fineAmount,
			"member": map[string]interface{}{
				"id":        mID,
				"name":      memberName,
				"className": memberClass.String,
			},
			"item": map[string]interface{}{
				"id":       itemID,
				"title":    itemTitle,
				"category": category,
				"catalog": map[string]interface{}{
					"title":    itemTitle,
					"category": category,
				},
			},
		}
		if returnDate.Valid {
			loan["returnDate"] = ToTime(returnDate)
		}
		results = append(results, loan)
	}
	return results, nil
}

func (r *LibraryRepository) FindActiveLoanByItemID(itemID string) (map[string]interface{}, error) {
	var id, memberID, realItemID, memberName, itemTitle string
	var memberClass sql.NullString
	var borrowDate, dueDate, returnDate sql.NullInt64
	var isReturned int
	var fineAmount int

	err := r.DB.QueryRow(`
		SELECT
			l.id, l.member_id, l.item_id, l.borrow_date, l.due_date, l.return_date, l.is_returned, l.fine_amount,
			m.name, m.class_name,
			c.title
		FROM library_loans l
		JOIN library_members m ON l.member_id = m.id
		JOIN library_assets a ON l.item_id = a.id
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE l.item_id = ? AND l.is_returned = 0
		LIMIT 1
	`, itemID).Scan(&id, &memberID, &realItemID, &borrowDate, &dueDate, &returnDate, &isReturned, &fineAmount, &memberName, &memberClass, &itemTitle)
	if err != nil {
		return nil, err
	}

	loan := map[string]interface{}{
		"id":         id,
		"memberId":   memberID,
		"itemId":     realItemID,
		"borrowDate": ToTime(borrowDate),
		"dueDate":    ToTime(dueDate),
		"returnDate": nil,
		"isReturned": isReturned == 1,
		"fineAmount": fineAmount,
		"member": map[string]interface{}{
			"id":        memberID,
			"name":      memberName,
			"className": memberClass.String,
		},
		"item": map[string]interface{}{
			"id":    realItemID,
			"title": itemTitle,
			"catalog": map[string]interface{}{
				"title": itemTitle,
			},
		},
	}
	if returnDate.Valid {
		loan["returnDate"] = ToTime(returnDate)
	}
	return loan, nil
}

// Visits
func (r *LibraryRepository) RecordVisit(memberId string) error {
	now := time.Now()
	date := now.Format("2006-01-02")
	timeStr := now.Format("15:04:05")
	id := cuid2.Generate()

	_, err := r.DB.Exec(`
		INSERT INTO library_visits (id, member_id, date, time, timestamp, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, memberId, date, timeStr, UnixMilli(), UnixMilli())
	return err
}

func (r *LibraryRepository) RecordGuestVisit(name, institution, purpose string) error {
	now := time.Now()
	date := now.Format("2006-01-02")
	timeStr := now.Format("15:04:05")
	id := cuid2.Generate()

	_, err := r.DB.Exec(`
		INSERT INTO library_visits (id, member_id, guest_name, guest_institution, guest_purpose, date, time, timestamp, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, "", name, institution, purpose, date, timeStr, UnixMilli(), UnixMilli())
	return err
}

func (r *LibraryRepository) GetVisits(date string) ([]map[string]interface{}, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	query := `
		SELECT 
			v.id, v.member_id, v.guest_name, v.guest_institution, v.guest_purpose, v.date, v.time, v.created_at,
			m.name as member_name, m.class_name as member_class
		FROM library_visits v
		LEFT JOIN library_members m ON v.member_id = m.id
		WHERE v.date = ?
		ORDER BY v.created_at DESC
	`
	rows, err := r.DB.Query(query, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, date, timeStr sql.NullString
		var mId, gName, gInst, gPurp, mName, mClass sql.NullString
		var crAt sql.NullInt64

		err := rows.Scan(&id, &mId, &gName, &gInst, &gPurp, &date, &timeStr, &crAt, &mName, &mClass)
		if err != nil {
			return nil, err
		}

		res := map[string]interface{}{
			"id":               id.String,
			"memberId":         mId.String,
			"guestName":        gName.String,
			"guestInstitution": gInst.String,
			"guestPurpose":     gPurp.String,
			"date":             date.String,
			"time":             timeStr.String,
			"createdAt":        ToTime(crAt),
			"memberName":       mName.String,
			"memberClass":      mClass.String,
		}
		results = append(results, res)
	}
	return results, nil
}

func (r *LibraryRepository) GetLoanReport(startDate, endDate string) ([]map[string]interface{}, error) {
	startMs, endMs := reportDateRangeMillis(startDate, endDate)
	rows, err := r.DB.Query(`
		SELECT
			l.id, m.name, m.class_name, c.title,
			l.borrow_date, l.due_date, l.return_date, l.is_returned, l.fine_amount
		FROM library_loans l
		JOIN library_members m ON l.member_id = m.id
		JOIN library_assets a ON l.item_id = a.id
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE l.borrow_date BETWEEN ? AND ?
		ORDER BY l.borrow_date DESC
	`, startMs, endMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, memberName, itemTitle string
		var memberClass sql.NullString
		var borrowDate, dueDate, returnDate sql.NullInt64
		var isReturned int
		var fineAmount int
		if err := rows.Scan(&id, &memberName, &memberClass, &itemTitle, &borrowDate, &dueDate, &returnDate, &isReturned, &fineAmount); err != nil {
			return nil, err
		}
		item := map[string]interface{}{
			"id":          id,
			"memberName":  memberName,
			"memberClass": memberClass.String,
			"itemTitle":   itemTitle,
			"borrowDate":  ToTime(borrowDate),
			"dueDate":     ToTime(dueDate),
			"returnDate":  nil,
			"isReturned":  isReturned == 1,
			"fineAmount":  fineAmount,
		}
		if returnDate.Valid && returnDate.Int64 > 0 {
			item["returnDate"] = ToTime(returnDate)
		}
		results = append(results, item)
	}
	return results, nil
}

func (r *LibraryRepository) GetVisitReport(startDate, endDate string) ([]map[string]interface{}, error) {
	startDate, endDate = reportDateRangeText(startDate, endDate)
	rows, err := r.DB.Query(`
		SELECT
			v.id,
			COALESCE(NULLIF(v.guest_name, ''), m.name, 'Tamu') AS visitor_name,
			m.class_name,
			v.date,
			v.timestamp,
			v.created_at
		FROM library_visits v
		LEFT JOIN library_members m ON v.member_id = m.id
		WHERE v.date BETWEEN ? AND ?
		ORDER BY v.date DESC, v.timestamp DESC, v.created_at DESC
	`, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, visitorName, date string
		var memberClass sql.NullString
		var timestamp, createdAt sql.NullInt64
		if err := rows.Scan(&id, &visitorName, &memberClass, &date, &timestamp, &createdAt); err != nil {
			return nil, err
		}
		visitTime := timestamp
		if !visitTime.Valid || visitTime.Int64 <= 0 {
			visitTime = createdAt
		}
		results = append(results, map[string]interface{}{
			"id":          id,
			"memberName":  visitorName,
			"memberClass": memberClass.String,
			"date":        date,
			"timestamp":   ToTime(visitTime),
		})
	}
	return results, nil
}

func (r *LibraryRepository) GetOverdueReport() ([]map[string]interface{}, error) {
	return r.GetLoans("overdue")
}

func (r *LibraryRepository) GetInventoryReport() (map[string]interface{}, error) {
	total := 0
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM library_assets").Scan(&total); err != nil {
		return nil, err
	}

	byStatus := map[string]int{
		"AVAILABLE": 0,
		"BORROWED":  0,
		"DAMAGED":   0,
		"LOST":      0,
	}
	statusRows, err := r.DB.Query("SELECT status, COUNT(*) FROM library_assets GROUP BY status")
	if err != nil {
		return nil, err
	}
	defer statusRows.Close()
	for statusRows.Next() {
		var status string
		var count int
		if err := statusRows.Scan(&status, &count); err != nil {
			return nil, err
		}
		byStatus[status] = count
	}

	byCategory := make(map[string]int)
	categoryRows, err := r.DB.Query(`
		SELECT COALESCE(NULLIF(c.category, ''), 'OTHER'), COUNT(*)
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		GROUP BY COALESCE(NULLIF(c.category, ''), 'OTHER')
	`)
	if err != nil {
		return nil, err
	}
	defer categoryRows.Close()
	for categoryRows.Next() {
		var category string
		var count int
		if err := categoryRows.Scan(&category, &count); err != nil {
			return nil, err
		}
		byCategory[category] = count
	}

	return map[string]interface{}{
		"total":      total,
		"byStatus":   byStatus,
		"byCategory": byCategory,
	}, nil
}

func (r *LibraryRepository) LookupISBN(isbn string) (map[string]interface{}, error) {
	isbn = strings.TrimSpace(isbn)
	if isbn == "" {
		return nil, sql.ErrNoRows
	}
	normalizedISBN := normalizeISBN(isbn)
	if normalizedISBN == "" {
		return nil, sql.ErrNoRows
	}

	var catalogID, title, category string
	var author, publisher, description, cover sql.NullString
	var year sql.NullInt64
	var totalExemplars int
	err := r.DB.QueryRow(`
		SELECT
			c.id, c.title, c.author, c.publisher, c.year, c.category, c.description, c.cover,
			COUNT(a.id) AS total_exemplars
		FROM library_catalog c
		LEFT JOIN library_assets a ON a.catalog_id = c.id
		WHERE REPLACE(REPLACE(REPLACE(UPPER(COALESCE(c.isbn, '')), '-', ''), ' ', ''), '.', '') = ?
		GROUP BY c.id
		LIMIT 1
	`, normalizedISBN).Scan(&catalogID, &title, &author, &publisher, &year, &category, &description, &cover, &totalExemplars)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return lookupISBNOnline(normalizedISBN)
		}
		return nil, err
	}

	return map[string]interface{}{
		"id":             catalogID,
		"title":          title,
		"author":         author.String,
		"publisher":      publisher.String,
		"year":           year.Int64,
		"isbn":           normalizedISBN,
		"cover":          cover.String,
		"coverUrl":       cover.String,
		"subjects":       []string{},
		"ddcCategory":    category,
		"category":       category,
		"description":    description.String,
		"localFound":     true,
		"totalExemplars": totalExemplars,
	}, nil
}

func (r *LibraryRepository) BindAsset(qrCode, location string, catalog map[string]interface{}) error {
	qrCode = strings.TrimSpace(qrCode)
	if qrCode == "" {
		return errors.New("QR code wajib diisi")
	}
	title := strings.TrimSpace(mapString(catalog, "title"))
	if title == "" {
		return errors.New("Judul buku wajib diisi")
	}
	category := strings.TrimSpace(mapString(catalog, "category"))
	if category == "" {
		category = strings.TrimSpace(mapString(catalog, "ddcCategory"))
	}
	if category == "" {
		category = "UNSORTED"
	}
	isbn := strings.TrimSpace(mapString(catalog, "isbn"))

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var exists int
	if err := tx.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = ?", qrCode).Scan(&exists); err != nil {
		return err
	}
	if exists > 0 {
		return errors.New("QR code sudah terdaftar sebagai aset perpustakaan")
	}

	now := UnixMilli()
	catalogID := ""
	if isbn != "" {
		_ = tx.QueryRow("SELECT id FROM library_catalog WHERE isbn = ? LIMIT 1", isbn).Scan(&catalogID)
	}
	if catalogID == "" {
		// Fallback to title and author match to prevent duplicates for books without ISBN
		_ = tx.QueryRow("SELECT id FROM library_catalog WHERE LOWER(title) = LOWER(?) AND LOWER(author) = LOWER(?) LIMIT 1", title, mapString(catalog, "author")).Scan(&catalogID)
	}

	year := mapInt(catalog, "year")
	if catalogID == "" {
		catalogID = cuid2.Generate()
		_, err = tx.Exec(`
			INSERT INTO library_catalog (id, isbn, title, author, publisher, year, category, description, cover, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, catalogID, isbn, title, mapString(catalog, "author"), mapString(catalog, "publisher"), year, category, mapString(catalog, "description"), mapString(catalog, "cover"), now, now)
		if err != nil {
			return err
		}
	} else {
		// Prevent silent master overwrite: fetch existing values and only merge empty/new fields
		var existingISBN, existingTitle, existingAuthor, existingPublisher, existingCategory, existingDescription, existingCover sql.NullString
		var existingYear sql.NullInt64
		err = tx.QueryRow(`
			SELECT isbn, title, author, publisher, year, category, description, cover
			FROM library_catalog
			WHERE id = ?
		`, catalogID).Scan(&existingISBN, &existingTitle, &existingAuthor, &existingPublisher, &existingYear, &existingCategory, &existingDescription, &existingCover)
		if err == nil {
			updated := false
			
			if (!existingISBN.Valid || existingISBN.String == "") && isbn != "" {
				existingISBN.String = isbn
				existingISBN.Valid = true
				updated = true
			}
			
			newAuthor := mapString(catalog, "author")
			if (!existingAuthor.Valid || existingAuthor.String == "") && newAuthor != "" {
				existingAuthor.String = newAuthor
				existingAuthor.Valid = true
				updated = true
			}
			
			newPublisher := mapString(catalog, "publisher")
			if (!existingPublisher.Valid || existingPublisher.String == "") && newPublisher != "" {
				existingPublisher.String = newPublisher
				existingPublisher.Valid = true
				updated = true
			}
			
			if (!existingYear.Valid || existingYear.Int64 == 0) && year > 0 {
				existingYear.Int64 = int64(year)
				existingYear.Valid = true
				updated = true
			}
			
			// Update category if existing is unsorted/other and new is a valid sorted category
			if (!existingCategory.Valid || existingCategory.String == "" || existingCategory.String == "UNSORTED" || existingCategory.String == "OTHER") && category != "" && category != "UNSORTED" && category != "OTHER" {
				existingCategory.String = category
				existingCategory.Valid = true
				updated = true
			}
			
			newDescription := mapString(catalog, "description")
			if (!existingDescription.Valid || existingDescription.String == "") && newDescription != "" {
				existingDescription.String = newDescription
				existingDescription.Valid = true
				updated = true
			}
			
			newCover := mapString(catalog, "cover")
			if (!existingCover.Valid || existingCover.String == "") && newCover != "" {
				existingCover.String = newCover
				existingCover.Valid = true
				updated = true
			}
			
			if updated {
				_, err = tx.Exec(`
					UPDATE library_catalog
					SET isbn = ?, author = ?, publisher = ?, year = ?, category = ?, description = ?, cover = ?, updated_at = ?
					WHERE id = ?
				`, existingISBN.String, existingAuthor.String, existingPublisher.String, existingYear.Int64, existingCategory.String, existingDescription.String, existingCover.String, now, catalogID)
				if err != nil {
					return err
				}
			}
		}
	}

	_, err = tx.Exec(`
		INSERT INTO library_assets (id, catalog_id, status, location, condition, created_at, updated_at)
		VALUES (?, ?, 'AVAILABLE', ?, 'Baik', ?, ?)
	`, qrCode, catalogID, location, now, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *LibraryRepository) GenerateQRBatch(prefix string, count int) ([]string, map[string]interface{}, error) {
	if err := r.ensureQRBatchTable(); err != nil {
		return nil, nil, err
	}
	prefix = strings.ToUpper(strings.TrimSpace(prefix))
	if prefix == "" {
		prefix = "BK"
	}
	if count < 1 {
		count = 1
	}
	if count > 500 {
		count = 500
	}

	date := time.Now().Format("2006-01-02")
	dateCode := time.Now().Format("20060102")
	startSequence := 1
	if err := r.DB.QueryRow(`
		SELECT COALESCE(MAX(end_sequence), 0) + 1
		FROM library_qr_batches
		WHERE prefix = ? AND date = ?
	`, prefix, date).Scan(&startSequence); err != nil {
		return nil, nil, err
	}
	endSequence := startSequence + count - 1

	codes := make([]string, 0, count)
	for i := startSequence; i <= endSequence; i++ {
		codes = append(codes, fmt.Sprintf("%s-%s-%04d", prefix, dateCode, i))
	}

	id := cuid2.Generate()
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO library_qr_batches (id, date, prefix, start_sequence, end_sequence, batch_size, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, date, prefix, startSequence, endSequence, count, now)
	if err != nil {
		return nil, nil, err
	}

	batch := map[string]interface{}{
		"id":            id,
		"date":          date,
		"prefix":        prefix,
		"startSequence": startSequence,
		"endSequence":   endSequence,
		"batchSize":     count,
		"createdAt":     time.Now(),
	}
	return codes, batch, nil
}

func (r *LibraryRepository) GetQRBatches(search, date string) ([]map[string]interface{}, error) {
	if err := r.ensureQRBatchTable(); err != nil {
		return nil, err
	}

	query := "SELECT id, date, prefix, start_sequence, end_sequence, batch_size, created_at FROM library_qr_batches WHERE 1=1"
	args := []interface{}{}
	if search = strings.TrimSpace(search); search != "" {
		query += " AND (prefix LIKE ? OR id LIKE ?)"
		like := "%" + search + "%"
		args = append(args, like, like)
	}
	if date = strings.TrimSpace(date); date != "" {
		query += " AND date = ?"
		args = append(args, date)
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	batches := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, batchDate, prefix string
		var startSequence, endSequence, batchSize int
		var createdAt sql.NullInt64
		if err := rows.Scan(&id, &batchDate, &prefix, &startSequence, &endSequence, &batchSize, &createdAt); err != nil {
			return nil, err
		}
		batches = append(batches, map[string]interface{}{
			"id":            id,
			"date":          batchDate,
			"prefix":        prefix,
			"startSequence": startSequence,
			"endSequence":   endSequence,
			"batchSize":     batchSize,
			"createdAt":     ToTime(createdAt),
		})
	}
	return batches, nil
}

func (r *LibraryRepository) ensureQRBatchTable() error {
	_, err := r.DB.Exec(`
		CREATE TABLE IF NOT EXISTS library_qr_batches (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			prefix TEXT NOT NULL,
			start_sequence INTEGER NOT NULL,
			end_sequence INTEGER NOT NULL,
			batch_size INTEGER NOT NULL,
			created_at INTEGER
		)
	`)
	return err
}

func reportDateRangeMillis(startDate, endDate string) (int64, int64) {
	startText, endText := reportDateRangeText(startDate, endDate)
	start, _ := time.ParseInLocation("2006-01-02", startText, time.Local)
	end, _ := time.ParseInLocation("2006-01-02", endText, time.Local)
	return start.UnixMilli(), end.AddDate(0, 0, 1).Add(-time.Millisecond).UnixMilli()
}

func reportDateRangeText(startDate, endDate string) (string, string) {
	now := time.Now()
	if strings.TrimSpace(endDate) == "" {
		endDate = now.Format("2006-01-02")
	}
	if strings.TrimSpace(startDate) == "" {
		startDate = now.AddDate(0, 0, -30).Format("2006-01-02")
	}
	return startDate, endDate
}

func mapString(data map[string]interface{}, key string) string {
	if data == nil {
		return ""
	}
	value, ok := data[key]
	if !ok || value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

func mapInt(data map[string]interface{}, key string) int {
	if data == nil {
		return 0
	}
	switch v := data[key].(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case float32:
		return int(v)
	case string:
		i, _ := strconv.Atoi(v)
		return i
	default:
		return 0
	}
}

func (r *LibraryRepository) BorrowItem(memberId string, itemId string, loanDays int) (*models.LibraryLoan, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Verify Member limit
	var maxLimit int
	err = tx.QueryRow("SELECT max_borrow_limit FROM library_members WHERE id = ?", memberId).Scan(&maxLimit)
	if err != nil {
		if err == sql.ErrNoRows {
			// Try by QR Code if ID not found
			err = tx.QueryRow("SELECT id, max_borrow_limit FROM library_members WHERE qr_code = ?", memberId).Scan(&memberId, &maxLimit)
			if err != nil {
				return nil, errors.New("member not found")
			}
		} else {
			return nil, err
		}
	}

	var currentLoans int
	err = tx.QueryRow("SELECT count(*) FROM library_loans WHERE member_id = ? AND is_returned = 0", memberId).Scan(&currentLoans)
	if err == nil && currentLoans >= maxLimit {
		return nil, errors.New("MAX_LIMIT_REACHED: member has reached maximum borrowing limit")
	}

	// 2. Verify Asset Available
	var status string
	var realItemId string
	err = tx.QueryRow("SELECT id, status FROM library_assets WHERE id = ?", itemId).Scan(&realItemId, &status)
	if err != nil {
		return nil, errors.New("asset not found")
	}
	if status != "AVAILABLE" {
		return nil, errors.New("asset is not available for borrowing")
	}

	// 3. Create Loan
	now := time.Now()
	if loanDays <= 0 {
		loanDays = 7
	}
	dueDate := now.AddDate(0, 0, loanDays)
	loanId := cuid2.Generate()

	_, err = tx.Exec(`
		INSERT INTO library_loans (id, member_id, item_id, borrow_date, due_date, is_returned, fine_amount, fine_paid, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
	`, loanId, memberId, realItemId, UnixMilli(), dueDate.UnixMilli(), UnixMilli(), UnixMilli())
	if err != nil {
		return nil, err
	}

	// 4. Update Asset
	_, err = tx.Exec("UPDATE library_assets SET status = 'BORROWED', updated_at = ? WHERE id = ?", UnixMilli(), realItemId)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &models.LibraryLoan{
		ID:         loanId,
		MemberID:   memberId,
		ItemID:     realItemId,
		BorrowDate: now,
		DueDate:    dueDate,
		IsReturned: false,
	}, nil
}

func (r *LibraryRepository) ReturnItem(loanId string) (*models.LibraryLoan, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var dueDateMi int64
	var itemId string
	err = tx.QueryRow("SELECT item_id, due_date FROM library_loans WHERE id = ? AND is_returned = 0", loanId).Scan(&itemId, &dueDateMi)
	if err != nil {
		if err == sql.ErrNoRows {
			// Try by Item ID (Asset QR)
			err = tx.QueryRow("SELECT id, item_id, due_date FROM library_loans WHERE item_id = ? AND is_returned = 0", loanId).Scan(&loanId, &itemId, &dueDateMi)
			if err != nil {
				return nil, errors.New("active loan not found")
			}
		} else {
			return nil, err
		}
	}

	dueDate := time.UnixMilli(dueDateMi)
	now := time.Now()
	fineAmount := 0
	if now.After(dueDate) {
		diff := now.Sub(dueDate).Hours() / 24
		daysLate := int(math.Ceil(diff))
		if daysLate > 0 {
			fineAmount = daysLate * 1000 // Custom fine rule logic
		}
	}

	_, err = tx.Exec(`
		UPDATE library_loans 
		SET return_date = ?, is_returned = 1, fine_amount = ?, updated_at = ?
		WHERE id = ?
	`, UnixMilli(), fineAmount, UnixMilli(), loanId)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec("UPDATE library_assets SET status = 'AVAILABLE', updated_at = ? WHERE id = ?", UnixMilli(), itemId)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	loan := &models.LibraryLoan{
		ID:         loanId,
		ItemID:     itemId,
		ReturnDate: &now,
		IsReturned: true,
		FineAmount: fineAmount,
	}

	return loan, nil
}

// Helpers
func (r *LibraryRepository) GetActiveLoansCountByStudentID(studentID string) (int, error) {
	var count int
	query := `
		SELECT COUNT(*) 
		FROM library_loans l
		JOIN library_members m ON l.member_id = m.id
		WHERE m.student_id = ? AND l.is_returned = 0
	`
	err := r.DB.QueryRow(query, studentID).Scan(&count)
	return count, err
}
