package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type LoanRepository struct {
	DB *sql.DB
}

func NewLoanRepository(db *sql.DB) *LoanRepository {
	return &LoanRepository{DB: db}
}

func (r *LoanRepository) GetLoans(borrowerType string, page, perPage int) ([]models.Loan, int, error) {
	where := "1=1"
	args := []interface{}{}
	if borrowerType != "" {
		where += " AND borrower_type = ?"
		args = append(args, borrowerType)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM loans WHERE "+where, args...).Scan(&total)

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	query := `
		SELECT l.id, COALESCE(l.employee_detail_id, ''), COALESCE(l.borrower_type, ''), COALESCE(l.borrower_name, ''),
		       COALESCE(l.description, ''), COALESCE(l.type, ''), l.amount_requested, COALESCE(l.amount_approved, 0),
		       l.tenor_months, COALESCE(l.admin_fee, 0), l.status, COALESCE(l.rejection_reason, ''),
		       COALESCE(l.notes, ''), COALESCE(l.disbursed_at, 0), l.created_at, COALESCE(l.updated_at, 0),
		       COALESCE(u.name, '')
		FROM loans l
		LEFT JOIN employee_details e ON l.employee_detail_id = e.id
		LEFT JOIN users u ON e.user_id = u.id
		WHERE ` + where + ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`
	listArgs := append(args, perPage, offset)

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.Loan
	for rows.Next() {
		var l models.Loan
		var empId, bName, desc, reject, notes, empName sql.NullString
		var appAmt sql.NullFloat64
		var disbAt, crAt, upAt sql.NullInt64

		err := rows.Scan(
			&l.ID, &empId, &l.BorrowerType, &bName, &desc, &l.Type,
			&l.AmountRequested, &appAmt, &l.TenorMonths, &l.AdminFee, &l.Status,
			&reject, &notes, &disbAt, &crAt, &upAt, &empName,
		)
		if err != nil {
			return nil, 0, err
		}

		if empId.Valid {
			l.EmployeeDetailID = &empId.String
		}
		if bName.Valid {
			l.BorrowerName = &bName.String
		}
		if desc.Valid {
			l.Description = &desc.String
		}
		if appAmt.Valid {
			l.AmountApproved = &appAmt.Float64
		}
		if reject.Valid {
			l.RejectionReason = &reject.String
		}
		if notes.Valid {
			l.Notes = &notes.String
		}

		dTime := ToTime(disbAt)
		l.DisbursedAt = &dTime
		cTime := ToTime(crAt)
		l.CreatedAt = &cTime
		uTime := ToTime(upAt)
		l.UpdatedAt = &uTime

		if empName.Valid {
			empNameStr := empName.String
			l.Employee = &models.Employee{Name: empNameStr}
		}

		r.DB.QueryRow("SELECT COALESCE(SUM(total_amount), 0) FROM loan_installments WHERE loan_id = ? AND status = 'PAID'", l.ID).Scan(&l.PaidAmount)
		base := l.AmountRequested
		if l.AmountApproved != nil {
			base = *l.AmountApproved
		}
		l.RemainingAmount = base + l.AdminFee - l.PaidAmount
		if l.RemainingAmount < 0 {
			l.RemainingAmount = 0
		}

		results = append(results, l)
	}
	if results == nil {
		results = []models.Loan{}
	}
	return results, total, nil
}

func (r *LoanRepository) CreateLoan(req models.CreateLoanRequest) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	status := "PENDING"
	if req.BorrowerType != "EMPLOYEE" {
		status = "APPROVED"
	}
	_, err := r.DB.Exec(`
		INSERT INTO loans (id, borrower_type, employee_detail_id, borrower_name, description, type, amount_requested, tenor_months, status, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.BorrowerType, req.EmployeeDetailID, req.BorrowerName, req.Description, req.Type, req.AmountRequested, req.TenorMonths, status, req.Notes, now, now)
	return err
}

func (r *LoanRepository) ApproveLoan(loanId string, req models.ApproveLoanRequest, userId string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var status string
	err = tx.QueryRow("SELECT status FROM loans WHERE id = ?", loanId).Scan(&status)
	if err != nil {
		return errors.New("Pinjaman tidak ditemukan")
	}
	if status != "PENDING" {
		return errors.New("Hanya pinjaman PENDING yang dapat disetujui")
	}

	var vaultBalance float64
	var vaultTipe string
	err = tx.QueryRow("SELECT saldo, tipe FROM tabungan_brankas WHERE id = ?", req.SourceVaultID).Scan(&vaultBalance, &vaultTipe)
	if err != nil {
		return errors.New("Brankas tidak ditemukan")
	}
	if vaultTipe != "cash" {
		return errors.New("Pencairan dana hanya boleh dari Brankas Tunai")
	}
	if vaultBalance < req.ApprovedAmount {
		return errors.New("Saldo brankas tidak mencukupi")
	}

	now := time.Now().UnixMilli()

	// 1. Update Loan
	_, err = tx.Exec("UPDATE loans SET status = 'APPROVED', amount_approved = ?, disbursed_at = ?, updated_at = ? WHERE id = ?",
		req.ApprovedAmount, now, now, loanId)
	if err != nil {
		return err
	}

	// 2. Deduct Vault
	_, err = tx.Exec("UPDATE tabungan_brankas SET saldo = saldo - ?, updated_at = ? WHERE id = ?", req.ApprovedAmount, now, req.SourceVaultID)
	if err != nil {
		return err
	}

	// 3. Log Vault Transaction
	_, err = tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		cuid2.Generate(), "tarik_dari_bank", int(req.ApprovedAmount), userId, "Pencairan pinjaman: "+loanId, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *LoanRepository) AddPayment(loanId string, req models.AddPaymentRequest, userId string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if req.Amount <= 0 {
		return errors.New("Nominal pembayaran harus lebih dari 0")
	}

	var status, borrowerType string
	var desc sql.NullString
	var amountApproved, adminFee float64
	err = tx.QueryRow(`
		SELECT status, borrower_type, description, COALESCE(amount_approved, amount_requested), admin_fee
		FROM loans WHERE id = ?
	`, loanId).Scan(&status, &borrowerType, &desc, &amountApproved, &adminFee)
	if err != nil {
		return errors.New("Pinjaman tidak ditemukan")
	}
	if status != "APPROVED" {
		return errors.New("Hanya pinjaman/hutang APPROVED yang dapat dibayar")
	}

	var vaultTipe string
	var vaultBalance float64
	err = tx.QueryRow("SELECT tipe, saldo FROM tabungan_brankas WHERE id = ?", req.TargetVaultID).Scan(&vaultTipe, &vaultBalance)
	if err != nil {
		return errors.New("Brankas tujuan tidak ditemukan")
	}
	if vaultTipe != "cash" {
		return errors.New("Pembayaran harus menggunakan Brankas Tunai")
	}
	if borrowerType != "EMPLOYEE" && vaultBalance < req.Amount {
		return errors.New("Saldo kas tidak mencukupi untuk membayar hutang")
	}

	now := time.Now().UnixMilli()

	// 1. Add Installment Record
	var count int
	tx.QueryRow("SELECT COUNT(*) FROM loan_installments WHERE loan_id = ?", loanId).Scan(&count)
	_, err = tx.Exec(`
		INSERT INTO loan_installments (id, loan_id, installment_number, due_date, principal_amount, total_amount, status, paid_at, payment_method, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'PAID', ?, 'CASH', ?, ?, ?)
	`, cuid2.Generate(), loanId, count+1, now, req.Amount, req.Amount, now, req.Notes, now, now)
	if err != nil {
		return err
	}

	// 2. Update Vault: employee receivables add cash, school payables deduct cash.
	operator := "+"
	txType := "setor_ke_bank"
	notePrefix := "Pembayaran piutang"
	if borrowerType != "EMPLOYEE" {
		operator = "-"
		txType = "tarik_dari_bank"
		notePrefix = "Pembayaran hutang"
	}
	_, err = tx.Exec(fmt.Sprintf("UPDATE tabungan_brankas SET saldo = saldo %s ?, updated_at = ? WHERE id = ?", operator), req.Amount, now, req.TargetVaultID)
	if err != nil {
		return err
	}

	// 3. Log Vault Tx
	descText := desc.String
	if descText == "" {
		descText = loanId
	}
	_, err = tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		cuid2.Generate(), txType, int(req.Amount), userId, fmt.Sprintf("%s %s (%s)", notePrefix, descText, loanId), now)
	if err != nil {
		return err
	}

	var paidTotal float64
	if err := tx.QueryRow("SELECT COALESCE(SUM(total_amount), 0) FROM loan_installments WHERE loan_id = ? AND status = 'PAID'", loanId).Scan(&paidTotal); err != nil {
		return err
	}
	if paidTotal >= amountApproved+adminFee {
		if _, err := tx.Exec("UPDATE loans SET status = 'PAID', updated_at = ? WHERE id = ?", now, loanId); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *LoanRepository) RejectLoan(loanId string, reason string) error {
	_, err := r.DB.Exec("UPDATE loans SET status = 'REJECTED', rejection_reason = ?, updated_at = ? WHERE id = ?",
		reason, time.Now().UnixMilli(), loanId)
	return err
}
