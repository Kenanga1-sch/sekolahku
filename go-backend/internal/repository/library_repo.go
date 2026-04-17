package repository

import (
	"database/sql"
	"errors"
	"math"
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

	now := time.Now().UnixMilli()
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

	var results []map[string]interface{}
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

	now := time.Now().UnixMilli()
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

	now := time.Now().UnixMilli()

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

	var members []models.LibraryMember
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
	now := time.Now().UnixMilli()
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
	now := time.Now().UnixMilli()
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

	// Get students NOT in library_members
	rows, err := tx.Query(`
		SELECT id, name, class_id FROM students 
		WHERE id NOT IN (SELECT student_id FROM library_members WHERE student_id IS NOT NULL)
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type stubStudent struct {
		ID    string
		Name  string
		Class string
	}
	var newMembers []stubStudent
	for rows.Next() {
		var s stubStudent
		rows.Scan(&s.ID, &s.Name, &s.Class)
		newMembers = append(newMembers, s)
	}
	rows.Close()

	now := time.Now().UnixMilli()
	count := 0
	for _, s := range newMembers {
		id := cuid2.Generate()
		_, err = tx.Exec(`
			INSERT INTO library_members (id, student_id, name, class_name, qr_code, max_borrow_limit, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 3, 1, ?, ?)
		`, id, s.ID, s.Name, s.Class, s.ID, now, now)
		if err == nil {
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
		now := time.Now().UnixMilli()
		query += " AND l.is_returned = 0 AND l.due_date < ?"
		args = append(args, now)
	}

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
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
	`, loanId, memberId, realItemId, now.UnixMilli(), dueDate.UnixMilli(), now.UnixMilli(), now.UnixMilli())
	if err != nil {
		return nil, err
	}

	// 4. Update Asset
	_, err = tx.Exec("UPDATE library_assets SET status = 'BORROWED', updated_at = ? WHERE id = ?", now.UnixMilli(), realItemId)
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
	`, now.UnixMilli(), fineAmount, now.UnixMilli(), loanId)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec("UPDATE library_assets SET status = 'AVAILABLE', updated_at = ? WHERE id = ?", now.UnixMilli(), itemId)
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
