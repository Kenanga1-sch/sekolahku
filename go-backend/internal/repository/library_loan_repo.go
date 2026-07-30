package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

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
