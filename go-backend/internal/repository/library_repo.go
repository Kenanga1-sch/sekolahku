package repository

import (
	"database/sql"
	"errors"
	"math"
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
			return nil, errors.New("member not found")
		}
		return nil, err
	}

	var currentLoans int
	err = tx.QueryRow("SELECT count(*) FROM library_loans WHERE member_id = ? AND is_returned = 0", memberId).Scan(&currentLoans)
	if err == nil && currentLoans >= maxLimit {
		return nil, errors.New("MAX_LIMIT_REACHED: member has reached maximum borrowing limit")
	}

	// 2. Verify Asset Available
	var status string
	err = tx.QueryRow("SELECT status FROM library_assets WHERE id = ?", itemId).Scan(&status)
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
	`, loanId, memberId, itemId, now, dueDate, now, now)
	if err != nil {
		return nil, err
	}

	// 4. Update Asset
	_, err = tx.Exec("UPDATE library_assets SET status = 'BORROWED', updated_at = ? WHERE id = ?", now, itemId)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &models.LibraryLoan{
		ID:         loanId,
		MemberID:   memberId,
		ItemID:     itemId,
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

	var dueDate time.Time
	var itemId string
	err = tx.QueryRow("SELECT item_id, due_date FROM library_loans WHERE id = ? AND is_returned = 0", loanId).Scan(&itemId, &dueDate)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("active loan not found")
		}
		return nil, err
	}

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
	`, now, fineAmount, now, loanId)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec("UPDATE library_assets SET status = 'AVAILABLE', updated_at = ? WHERE id = ?", now, itemId)
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
