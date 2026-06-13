package repository

import (
	"database/sql"
	"errors"
	"fmt"
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
func (r *LibraryRepository) GetBooks(page, perPage int, search, category, statusFilter string) ([]models.BookDetail, int, error) {
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

	if statusFilter != "" {
		query += " AND a.status = ?"
		args = append(args, strings.ToUpper(statusFilter))
	}

	countQuery := "SELECT COUNT(*) FROM (" + query + ")"
	var totalItems int
	err := r.DB.QueryRow(countQuery, args...).Scan(&totalItems)
	if err != nil {
		return nil, 0, err
	}

	query += " ORDER BY c.title ASC LIMIT ? OFFSET ?"
	args = append(args, perPage, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	results := make([]models.BookDetail, 0)
	for rows.Next() {
		var a models.LibraryAsset
		var asAt, asUp sql.NullInt64
		var isbn, author, publisher, cDesc, cCover, aLoc, aCond sql.NullString
		var cYear sql.NullInt64
		var cTitle, cCategory string

		if err := rows.Scan(
			&a.ID, &a.CatalogID, &a.Status, &aLoc, &aCond, &asAt, &asUp,
			&cTitle, &author, &isbn, &publisher, &cYear, &cCategory, &cDesc, &cCover,
		); err != nil {
			return nil, 0, err
		}

		results = append(results, models.BookDetail{
			ID:        a.ID,
			CatalogID: a.CatalogID,
			Status:    a.Status,
			Location:  aLoc.String,
			Condition: aCond.String,
			CreatedAt: ToTime(asAt),
			UpdatedAt: ToTime(asUp),
			Title:     cTitle,
			Author:    author.String,
			ISBN:      isbn.String,
			Publisher: publisher.String,
			Year:      int(cYear.Int64),
			Category:  cCategory,
			Catalog: &models.LibraryCatalogMini{
				ID:          a.CatalogID,
				Isbn:        isbn.String,
				Title:       cTitle,
				Author:      author.String,
				Publisher:   publisher.String,
				Year:        int(cYear.Int64),
				Category:    cCategory,
				Description: cDesc.String,
				Cover:       cCover.String,
			},
		})
	}

	return results, totalItems, nil
}

func (r *LibraryRepository) CreateBook(input models.CreateBookRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := UnixMilli()
	catalogId := cuid2.Generate()

	_, err = tx.Exec(`
		INSERT INTO library_catalog (id, isbn, title, author, publisher, year, category, description, cover, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, catalogId, input.ISBN, input.Title, input.Author, input.Publisher, input.Year, input.Category, input.Description, input.Cover, now, now)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") && input.ISBN != "" {
			err = tx.QueryRow("SELECT id FROM library_catalog WHERE isbn = ?", input.ISBN).Scan(&catalogId)
			if err != nil {
				return err
			}
		} else {
			return err
		}
	}

	copies := input.Copies
	if copies < 1 {
		copies = 1
	}
	if copies > 100 {
		copies = 100
	}

	for i := 0; i < copies; i++ {
		assetId := cuid2.Generate()
		_, err = tx.Exec(`
			INSERT INTO library_assets (id, catalog_id, status, location, condition, created_at, updated_at)
			VALUES (?, ?, 'AVAILABLE', ?, 'Baik', ?, ?)
		`, assetId, catalogId, input.Location, now, now)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *LibraryRepository) UpdateBook(id string, input models.UpdateBookRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := UnixMilli()

	var catalogId string
	err = tx.QueryRow("SELECT catalog_id FROM library_assets WHERE id = ?", id).Scan(&catalogId)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		UPDATE library_catalog 
		SET title = ?, author = ?, isbn = ?, publisher = ?, year = ?, category = ?, description = ?, updated_at = ?
		WHERE id = ?
	`, input.Title, input.Author, input.ISBN, input.Publisher, input.Year, input.Category, input.Description, now, catalogId)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		UPDATE library_assets SET location = ?, updated_at = ? WHERE id = ?
	`, input.Location, now, id)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *LibraryRepository) DeleteBook(id string) error {
	var status string
	if err := r.DB.QueryRow("SELECT status FROM library_assets WHERE id = ?", id).Scan(&status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("buku tidak ditemukan")
		}
		return err
	}
	if status == "BORROWED" {
		return errors.New("buku sedang dipinjam, tidak dapat dihapus")
	}
	_, err := r.DB.Exec("DELETE FROM library_assets WHERE id = ?", id)
	return err
}

func (r *LibraryRepository) SwapQR(oldId, newId string) error {
	if oldId == "" || newId == "" {
		return errors.New("QR code lama dan baru wajib diisi")
	}
	if oldId == newId {
		return errors.New("QR code baru harus berbeda dari yang lama")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var oldExists int
	if err := tx.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = ?", oldId).Scan(&oldExists); err != nil {
		return err
	}
	if oldExists == 0 {
		return errors.New("QR code lama tidak ditemukan")
	}

	var newExists int
	if err := tx.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = ?", newId).Scan(&newExists); err != nil {
		return err
	}
	if newExists > 0 {
		return errors.New("QR code baru sudah terdaftar")
	}

	_, err = tx.Exec("UPDATE library_assets SET id = ? WHERE id = ?", newId, oldId)
	if err != nil {
		return errors.New("gagal memperbarui ID aset: " + err.Error())
	}

	_, err = tx.Exec("UPDATE library_loans SET item_id = ? WHERE item_id = ?", newId, oldId)
	if err != nil {
		return errors.New("gagal memperbarui referensi peminjaman: " + err.Error())
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
		m.QrCode = m.ID
	}
	if m.Name == "" {
		return errors.New("nama anggota wajib diisi")
	}

	if m.StudentID != nil && *m.StudentID != "" {
		var exists int
		if err := r.DB.QueryRow("SELECT COUNT(*) FROM library_members WHERE student_id = ?", *m.StudentID).Scan(&exists); err != nil {
			return err
		}
		if exists > 0 {
			return errors.New("siswa ini sudah terdaftar sebagai anggota perpustakaan")
		}
	}

	_, err := r.DB.Exec(`
		INSERT INTO library_members (id, user_id, student_id, name, class_name, qr_code, max_borrow_limit, photo, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, m.ID, m.UserID, m.StudentID, m.Name, m.ClassName, m.QrCode, m.MaxBorrowLimit, m.Photo, 1, now, now)
	return err
}

func (r *LibraryRepository) UpdateMember(id string, input models.UpdateMemberRequest) error {
	now := UnixMilli()

	maxBorrowLimit := input.MaxBorrowLimit
	if maxBorrowLimit < 1 {
		maxBorrowLimit = 3
	}

	isActive := 1
	if input.IsActive != nil {
		if *input.IsActive {
			isActive = 1
		} else {
			isActive = 0
		}
	} else {
		var cur sql.NullInt64
		r.DB.QueryRow("SELECT is_active FROM library_members WHERE id = ?", id).Scan(&cur)
		if cur.Valid {
			isActive = int(cur.Int64)
		}
	}

	_, err := r.DB.Exec(`
		UPDATE library_members 
		SET name = ?, class_name = ?, student_id = ?, qr_code = ?, max_borrow_limit = ?, photo = ?, is_active = ?, updated_at = ?
		WHERE id = ?
	`, input.Name, input.ClassName, input.StudentID, input.QRCode, maxBorrowLimit, input.Photo, isActive, now, id)
	return err
}

func (r *LibraryRepository) GetMemberLoanHistory(memberID string, limit int) ([]models.LoanHistoryItem, error) {
	if limit < 1 || limit > 200 {
		limit = 50
	}
	rows, err := r.DB.Query(`
		SELECT
			l.id, l.item_id, l.borrow_date, l.due_date, l.return_date, l.is_returned, l.fine_amount, l.fine_paid,
			c.title
		FROM library_loans l
		JOIN library_assets a ON l.item_id = a.id
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE l.member_id = ?
		ORDER BY l.borrow_date DESC
		LIMIT ?
	`, memberID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.LoanHistoryItem, 0)
	for rows.Next() {
		var id, itemID, title string
		var brAt, duAt, reAt sql.NullInt64
		var isReturned, finePaid int
		var fineAmount int

		if err := rows.Scan(&id, &itemID, &brAt, &duAt, &reAt, &isReturned, &fineAmount, &finePaid, &title); err != nil {
			return nil, err
		}
		item := models.LoanHistoryItem{
			ID:         id,
			ItemID:     itemID,
			Title:      title,
			BorrowDate: ToTime(brAt),
			DueDate:    ToTime(duAt),
			IsReturned: isReturned == 1,
			FineAmount: fineAmount,
			FinePaid:   finePaid == 1,
		}
		if reAt.Valid {
			item.ReturnDate = ToTime(reAt)
		}
		results = append(results, item)
	}
	return results, nil
}

func (r *LibraryRepository) DeleteMember(id string) error {
	var activeLoans int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM library_loans WHERE member_id = ? AND is_returned = 0", id).Scan(&activeLoans); err != nil {
		return err
	}
	if activeLoans > 0 {
		return fmt.Errorf("anggota masih memiliki %d pinjaman aktif, tidak dapat dihapus", activeLoans)
	}
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
func (r *LibraryRepository) GetLoans(loanType string, page, perPage int) ([]models.LoanDetail, int, error) {
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

	countQuery := "SELECT COUNT(*) FROM (" + query + ")"
	var totalItems int
	if err := r.DB.QueryRow(countQuery, args...).Scan(&totalItems); err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	offset := (page - 1) * perPage

	query += " ORDER BY l.borrow_date DESC LIMIT ? OFFSET ?"
	args = append(args, perPage, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	results := make([]models.LoanDetail, 0)
	for rows.Next() {
		var l models.LibraryLoan
		var brAt, duAt, reAt sql.NullInt64
		var mName, mClass, iTitle sql.NullString
		var isRet int

		if err := rows.Scan(
			&l.ID, &l.MemberID, &l.ItemID, &brAt, &duAt, &reAt, &isRet, &l.FineAmount,
			&mName, &mClass, &iTitle,
		); err != nil {
			return nil, 0, err
		}

		res := models.LoanDetail{
			ID:         l.ID,
			MemberID:   l.MemberID,
			ItemID:     l.ItemID,
			BorrowDate: ToTime(brAt),
			DueDate:    ToTime(duAt),
			IsReturned: isRet == 1,
			FineAmount: l.FineAmount,
			Member: &models.LoanMemberMini{
				Name:      mName.String,
				ClassName: mClass.String,
			},
			Item: &models.LoanItemMini{
				ID: l.ItemID,
				Catalog: &models.LoanCatalogMini{
					Title: iTitle.String,
				},
			},
		}
		if reAt.Valid {
			res.ReturnDate = ToTime(reAt)
		}
		results = append(results, res)
	}

	return results, totalItems, nil
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

func (r *LibraryRepository) GetAssetByCode(code string) (*models.BookDetail, error) {
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

	return &models.BookDetail{
		ID:          assetID,
		CatalogID:   catalogID,
		Status:      status,
		Location:    location.String,
		Condition:   condition.String,
		CreatedAt:   ToTime(createdAt),
		UpdatedAt:   ToTime(updatedAt),
		Title:       title,
		Author:      author.String,
		ISBN:        isbn.String,
		Publisher:   publisher.String,
		Year:        int(year.Int64),
		Category:    category,
		Description: description.String,
		Cover:       cover.String,
		Catalog: &models.LibraryCatalogMini{
			ID:          catalogID,
			Isbn:        isbn.String,
			Title:       title,
			Author:      author.String,
			Publisher:   publisher.String,
			Year:        int(year.Int64),
			Category:    category,
			Description: description.String,
			Cover:       cover.String,
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

func (r *LibraryRepository) GetActiveLoansByMemberID(memberID string) ([]models.LoanDetail, error) {
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

	results := make([]models.LoanDetail, 0)
	for rows.Next() {
		var id, mID, itemID, memberName, itemTitle, category string
		var memberClass sql.NullString
		var borrowDate, dueDate, returnDate sql.NullInt64
		var isReturned int
		var fineAmount int

		if err := rows.Scan(&id, &mID, &itemID, &borrowDate, &dueDate, &returnDate, &isReturned, &fineAmount, &memberName, &memberClass, &itemTitle, &category); err != nil {
			return nil, err
		}

		loan := models.LoanDetail{
			ID:         id,
			MemberID:   mID,
			ItemID:     itemID,
			BorrowDate: ToTime(borrowDate),
			DueDate:    ToTime(dueDate),
			IsReturned: isReturned == 1,
			FineAmount: fineAmount,
			Member: &models.LoanMemberMini{
				ID:        mID,
				Name:      memberName,
				ClassName: memberClass.String,
			},
			Item: &models.LoanItemMini{
				ID:       itemID,
				Title:    itemTitle,
				Category: category,
				Catalog: &models.LoanCatalogMini{
					Title:    itemTitle,
					Category: category,
				},
			},
		}
		if returnDate.Valid {
			loan.ReturnDate = ToTime(returnDate)
		}
		results = append(results, loan)
	}
	return results, nil
}

func (r *LibraryRepository) FindActiveLoanByItemID(itemID string) (*models.LoanDetail, error) {
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

	loan := models.LoanDetail{
		ID:         id,
		MemberID:   memberID,
		ItemID:     realItemID,
		BorrowDate: ToTime(borrowDate),
		DueDate:    ToTime(dueDate),
		IsReturned: isReturned == 1,
		FineAmount: fineAmount,
		Member: &models.LoanMemberMini{
			ID:        memberID,
			Name:      memberName,
			ClassName: memberClass.String,
		},
		Item: &models.LoanItemMini{
			ID:    realItemID,
			Title: itemTitle,
			Catalog: &models.LoanCatalogMini{
				Title: itemTitle,
			},
		},
	}
	if returnDate.Valid {
		loan.ReturnDate = ToTime(returnDate)
	}
	return &loan, nil
}

// Visits
func (r *LibraryRepository) RecordVisit(memberId string) error {
	var exists int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM library_members WHERE id = ?", memberId).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return errors.New("anggota perpustakaan tidak ditemukan")
	}

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

func (r *LibraryRepository) GetVisits(date string, page, perPage int) ([]models.VisitDetail, int, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM library_visits WHERE date = ?", date).Scan(&total)

	query := `
		SELECT 
			v.id, v.member_id, v.guest_name, v.guest_institution, v.guest_purpose, v.date, v.time, v.created_at,
			m.name as member_name, m.class_name as member_class
		FROM library_visits v
		LEFT JOIN library_members m ON v.member_id = m.id
		WHERE v.date = ?
		ORDER BY v.created_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.DB.Query(query, date, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	results := make([]models.VisitDetail, 0)
	for rows.Next() {
		var id, date, timeStr sql.NullString
		var mId, gName, gInst, gPurp, mName, mClass sql.NullString
		var crAt sql.NullInt64

		if err := rows.Scan(&id, &mId, &gName, &gInst, &gPurp, &date, &timeStr, &crAt, &mName, &mClass); err != nil {
			return nil, 0, err
		}

		results = append(results, models.VisitDetail{
			ID:               id.String,
			MemberID:         mId.String,
			GuestName:        gName.String,
			GuestInstitution: gInst.String,
			GuestPurpose:     gPurp.String,
			Date:             date.String,
			Time:             timeStr.String,
			CreatedAt:        ToTime(crAt),
			MemberName:       mName.String,
			MemberClass:      mClass.String,
		})
	}
	return results, total, nil
}

func (r *LibraryRepository) GetLoanReport(startDate, endDate string, limit int) ([]models.LoanReportItem, error) {
	startMs, endMs := reportDateRangeMillis(startDate, endDate)
	if limit < 1 || limit > 5000 {
		limit = 1000
	}
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
		LIMIT ?
	`, startMs, endMs, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.LoanReportItem, 0)
	for rows.Next() {
		var id, memberName, itemTitle string
		var memberClass sql.NullString
		var borrowDate, dueDate, returnDate sql.NullInt64
		var isReturned int
		var fineAmount int
		if err := rows.Scan(&id, &memberName, &memberClass, &itemTitle, &borrowDate, &dueDate, &returnDate, &isReturned, &fineAmount); err != nil {
			return nil, err
		}
		item := models.LoanReportItem{
			ID:          id,
			MemberName:  memberName,
			MemberClass: memberClass.String,
			ItemTitle:   itemTitle,
			BorrowDate:  ToTime(borrowDate),
			DueDate:     ToTime(dueDate),
			IsReturned:  isReturned == 1,
			FineAmount:  fineAmount,
		}
		if returnDate.Valid && returnDate.Int64 > 0 {
			item.ReturnDate = ToTime(returnDate)
		}
		results = append(results, item)
	}
	return results, nil
}

func (r *LibraryRepository) GetVisitReport(startDate, endDate string, limit int) ([]models.VisitReportItem, error) {
	startDate, endDate = reportDateRangeText(startDate, endDate)
	if limit < 1 || limit > 5000 {
		limit = 1000
	}
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
		LIMIT ?
	`, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.VisitReportItem, 0)
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
		results = append(results, models.VisitReportItem{
			ID:          id,
			MemberName:  visitorName,
			MemberClass: memberClass.String,
			Date:        date,
			Timestamp:   ToTime(visitTime),
		})
	}
	return results, nil
}

func (r *LibraryRepository) GetOverdueReport() ([]models.LoanDetail, error) {
	loans, _, err := r.GetLoans("overdue", 1, 1000)
	return loans, err
}

func (r *LibraryRepository) GetInventoryReport() (*models.InventoryReport, error) {
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

	return &models.InventoryReport{
		Total:      total,
		ByStatus:   byStatus,
		ByCategory: byCategory,
	}, nil
}

func (r *LibraryRepository) LookupISBN(isbn string) (*models.ISBNLookupResponse, error) {
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
			merged, err := lookupISBNOnline(normalizedISBN)
			if err != nil {
				return nil, err
			}
			return &models.ISBNLookupResponse{
				Title:          merged.Title,
				Author:         merged.Author,
				Publisher:      merged.Publisher,
				Year:           int64(merged.Year),
				ISBN:           merged.ISBN,
				Cover:          merged.CoverURL,
				CoverURL:       merged.CoverURL,
				Subjects:       merged.Subjects,
				DDCCategory:    merged.DDCCategory,
				Category:       merged.Category,
				Description:    merged.Description,
				Sources:        merged.Sources,
			}, nil
		}
		return nil, err
	}

	return &models.ISBNLookupResponse{
		ID:             catalogID,
		Title:          title,
		Author:         author.String,
		Publisher:      publisher.String,
		Year:           year.Int64,
		ISBN:           normalizedISBN,
		Cover:          cover.String,
		CoverURL:       cover.String,
		Subjects:       []string{},
		DDCCategory:    category,
		Category:       category,
		Description:    description.String,
		LocalFound:     true,
		TotalExemplars: totalExemplars,
	}, nil
}

func (r *LibraryRepository) BindAsset(qrCode, location string, catalog models.CatalogInput) error {
	qrCode = strings.TrimSpace(qrCode)
	if qrCode == "" {
		return errors.New("QR code wajib diisi")
	}
	title := strings.TrimSpace(catalog.Title)
	if title == "" {
		return errors.New("Judul buku wajib diisi")
	}
	category := strings.TrimSpace(catalog.Category)
	if category == "" {
		category = strings.TrimSpace(catalog.DDCCategory)
	}
	if category == "" {
		category = "UNSORTED"
	}
	isbn := strings.TrimSpace(catalog.ISBN)

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
		_ = tx.QueryRow("SELECT id FROM library_catalog WHERE LOWER(title) = LOWER(?) AND LOWER(author) = LOWER(?) LIMIT 1", title, catalog.Author).Scan(&catalogID)
	}

	year := catalog.Year
	if catalogID == "" {
		catalogID = cuid2.Generate()
		_, err = tx.Exec(`
			INSERT INTO library_catalog (id, isbn, title, author, publisher, year, category, description, cover, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, catalogID, isbn, title, catalog.Author, catalog.Publisher, year, category, catalog.Description, catalog.Cover, now, now)
		if err != nil {
			return err
		}
	} else {
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

			if (!existingAuthor.Valid || existingAuthor.String == "") && catalog.Author != "" {
				existingAuthor.String = catalog.Author
				existingAuthor.Valid = true
				updated = true
			}

			if (!existingPublisher.Valid || existingPublisher.String == "") && catalog.Publisher != "" {
				existingPublisher.String = catalog.Publisher
				existingPublisher.Valid = true
				updated = true
			}

			if (!existingYear.Valid || existingYear.Int64 == 0) && year > 0 {
				existingYear.Int64 = int64(year)
				existingYear.Valid = true
				updated = true
			}

			if (!existingCategory.Valid || existingCategory.String == "" || existingCategory.String == "UNSORTED" || existingCategory.String == "OTHER") && category != "" && category != "UNSORTED" && category != "OTHER" {
				existingCategory.String = category
				existingCategory.Valid = true
				updated = true
			}

			if (!existingDescription.Valid || existingDescription.String == "") && catalog.Description != "" {
				existingDescription.String = catalog.Description
				existingDescription.Valid = true
				updated = true
			}

			if (!existingCover.Valid || existingCover.String == "") && catalog.Cover != "" {
				existingCover.String = catalog.Cover
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

func (r *LibraryRepository) GenerateQRBatch(prefix string, count int) ([]string, *models.QRBatchItem, error) {
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

	batch := &models.QRBatchItem{
		ID:            id,
		Date:          date,
		Prefix:        prefix,
		StartSequence: startSequence,
		EndSequence:   endSequence,
		BatchSize:     count,
		CreatedAt:     time.Now(),
	}
	return codes, batch, nil
}

func (r *LibraryRepository) GetQRBatches(search, date string, page, perPage int) ([]models.QRBatchItem, int, error) {
	if err := r.ensureQRBatchTable(); err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	where := "1=1"
	args := []interface{}{}
	if search = strings.TrimSpace(search); search != "" {
		where += " AND (prefix LIKE ? OR id LIKE ?)"
		like := "%" + search + "%"
		args = append(args, like, like)
	}
	if date = strings.TrimSpace(date); date != "" {
		where += " AND date = ?"
		args = append(args, date)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM library_qr_batches WHERE "+where, args...).Scan(&total)

	listArgs := append(args, perPage, offset)
	query := "SELECT id, date, prefix, start_sequence, end_sequence, batch_size, created_at FROM library_qr_batches WHERE " + where + " ORDER BY created_at DESC LIMIT ? OFFSET ?"

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	batches := make([]models.QRBatchItem, 0)
	for rows.Next() {
		var id, batchDate, prefix string
		var startSequence, endSequence, batchSize int
		var createdAt sql.NullInt64
		if err := rows.Scan(&id, &batchDate, &prefix, &startSequence, &endSequence, &batchSize, &createdAt); err != nil {
			return nil, 0, err
		}
		batches = append(batches, models.QRBatchItem{
			ID:            id,
			Date:          batchDate,
			Prefix:        prefix,
			StartSequence: startSequence,
			EndSequence:   endSequence,
			BatchSize:     batchSize,
			CreatedAt:     ToTime(createdAt),
		})
	}
	return batches, total, nil
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
		INSERT INTO library_loans (id, member_id, item_id, borrow_date, due_date, is_returned, status, fine_amount, fine_paid, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, 'borrowed', 0, 0, ?, ?)
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

func (r *LibraryRepository) ReturnItem(loanId string, memberId ...string) (*models.LibraryLoan, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var dueDateMi int64
	var itemId string
	var loanMemberId string
	err = tx.QueryRow("SELECT item_id, due_date, member_id FROM library_loans WHERE id = ? AND is_returned = 0", loanId).Scan(&itemId, &dueDateMi, &loanMemberId)
	if err != nil {
		if err == sql.ErrNoRows {
			// Try by Item ID (Asset QR)
			err = tx.QueryRow("SELECT id, item_id, due_date, member_id FROM library_loans WHERE item_id = ? AND is_returned = 0", loanId).Scan(&loanId, &itemId, &dueDateMi, &loanMemberId)
			if err != nil {
				return nil, errors.New("active loan not found")
			}
		} else {
			return nil, err
		}
	}

	// If memberId is provided, verify ownership
	if len(memberId) > 0 && memberId[0] != "" && loanMemberId != memberId[0] {
		return nil, errors.New("buku ini dipinjam oleh anggota lain, tidak dapat dikembalikan")
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
		SET return_date = ?, is_returned = 1, status = 'returned', fine_amount = ?, updated_at = ?
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

func (r *LibraryRepository) PayFine(loanID string, amount int) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var fineAmount, finePaid int
	err = tx.QueryRow("SELECT fine_amount, fine_paid FROM library_loans WHERE id = ? AND is_returned = 1", loanID).Scan(&fineAmount, &finePaid)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("pinjaman tidak ditemukan atau belum dikembalikan")
		}
		return err
	}
	if finePaid > 0 {
		return errors.New("denda sudah dibayar sebelumnya")
	}
	if amount < fineAmount {
		return fmt.Errorf("pembayaran kurang: Rp %d (denda: Rp %d)", amount, fineAmount)
	}

	now := UnixMilli()
	_, err = tx.Exec("UPDATE library_loans SET fine_paid = 1, updated_at = ? WHERE id = ?", now, loanID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *LibraryRepository) RenewLoan(loanID string, extraDays int) (*models.LibraryLoan, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var dueDateMi int64
	err = tx.QueryRow("SELECT due_date FROM library_loans WHERE id = ? AND is_returned = 0", loanID).Scan(&dueDateMi)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("pinjaman aktif tidak ditemukan")
		}
		return nil, err
	}
	if extraDays <= 0 {
		extraDays = 7
	}
	if extraDays > 30 {
		return nil, errors.New("perpanjangan maksimal 30 hari")
	}

	newDueDate := time.UnixMilli(dueDateMi).AddDate(0, 0, extraDays)
	now := UnixMilli()
	_, err = tx.Exec("UPDATE library_loans SET due_date = ?, updated_at = ? WHERE id = ?", newDueDate.UnixMilli(), now, loanID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &models.LibraryLoan{
		ID:      loanID,
		DueDate: newDueDate,
	}, nil
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
