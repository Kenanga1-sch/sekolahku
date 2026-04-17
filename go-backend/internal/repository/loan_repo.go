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

func (r *LoanRepository) GetLoans(borrowerType string) ([]models.Loan, error) {
	query := `
		SELECT l.id, l.employee_detail_id, l.borrower_type, l.borrower_name, l.description, l.type, 
		       l.amount_requested, l.amount_approved, l.tenor_months, l.admin_fee, l.status, 
		       l.rejection_reason, l.notes, l.disbursed_at, l.created_at, l.updated_at,
		       u.name as emp_name
		FROM loans l
		LEFT JOIN employee_details d ON l.employee_detail_id = d.id
		LEFT JOIN users u ON d.user_id = u.id
		WHERE 1=1
	`
	var args []interface{}
	if borrowerType != "" {
		if borrowerType == "EMPLOYEE" {
			query += " AND l.borrower_type = 'EMPLOYEE'"
		} else {
			query += " AND l.borrower_type != 'EMPLOYEE'"
		}
	}
	query += " ORDER BY l.created_at DESC"

	rows, err := r.DB.Query(query, args...)
	if err != nil { return nil, err }
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
		if err != nil { return nil, err }

		if empId.Valid { l.EmployeeDetailID = &empId.String }
		if bName.Valid { l.BorrowerName = &bName.String }
		if desc.Valid { l.Description = &desc.String }
		if appAmt.Valid { l.AmountApproved = &appAmt.Float64 }
		if reject.Valid { l.RejectionReason = &reject.String }
		if notes.Valid { l.Notes = &notes.String }
		
		dTime := ToTime(disbAt); l.DisbursedAt = &dTime
		cTime := ToTime(crAt); l.CreatedAt = &cTime
		uTime := ToTime(upAt); l.UpdatedAt = &uTime

		if empName.Valid {
			empNameStr := empName.String
			l.Employee = &models.Employee{Name: empNameStr}
		}
		
		// Get paid amount
		r.DB.QueryRow("SELECT SUM(total_amount) FROM loan_installments WHERE loan_id = ? AND status = 'PAID'", l.ID).Scan(&l.PaidAmount)
		base := l.AmountRequested
		if l.AmountApproved != nil { base = *l.AmountApproved }
		l.RemainingAmount = base + l.AdminFee - l.PaidAmount

		results = append(results, l)
	}
	if results == nil { results = []models.Loan{} }
	return results, nil
}

func (r *LoanRepository) CreateLoan(req models.CreateLoanRequest) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO loans (id, borrower_type, employee_detail_id, borrower_name, description, type, amount_requested, tenor_months, status, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
	`, id, req.BorrowerType, req.EmployeeDetailID, req.BorrowerName, req.Description, req.Type, req.AmountRequested, req.TenorMonths, req.Notes, now, now)
	return err
}

func (r *LoanRepository) ApproveLoan(loanId string, req models.ApproveLoanRequest, userId string) error {
	tx, err := r.DB.Begin()
	if err != nil { return err }
	defer tx.Rollback()

	var status string
	err = tx.QueryRow("SELECT status FROM loans WHERE id = ?", loanId).Scan(&status)
	if err != nil { return errors.New("Pinjaman tidak ditemukan") }
	if status != "PENDING" { return errors.New("Hanya pinjaman PENDING yang dapat disetujui") }

	var vaultBalance float64
	var vaultTipe string
	err = tx.QueryRow("SELECT saldo, tipe FROM tabungan_brankas WHERE id = ?", req.SourceVaultID).Scan(&vaultBalance, &vaultTipe)
	if err != nil { return errors.New("Brankas tidak ditemukan") }
	if vaultTipe != "cash" { return errors.New("Pencairan dana hanya boleh dari Brankas Tunai") }
	if vaultBalance < req.ApprovedAmount { return errors.New("Saldo brankas tidak mencukupi") }

	now := time.Now().UnixMilli()
	
	// 1. Update Loan
	_, err = tx.Exec("UPDATE loans SET status = 'APPROVED', amount_approved = ?, disbursed_at = ?, updated_at = ? WHERE id = ?",
		req.ApprovedAmount, now, now, loanId)
	if err != nil { return err }

	// 2. Deduct Vault
	_, err = tx.Exec("UPDATE tabungan_brankas SET saldo = saldo - ?, updated_at = ? WHERE id = ?", req.ApprovedAmount, now, req.SourceVaultID)
	if err != nil { return err }

	// 3. Log Vault Transaction
	_, err = tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		cuid2.Generate(), "tarik_dari_bank", int(req.ApprovedAmount), userId, "Pencairan pinjaman: "+loanId, now)
	if err != nil { return err }

	return tx.Commit()
}

func (r *LoanRepository) AddPayment(loanId string, req models.AddPaymentRequest, userId string) error {
	tx, err := r.DB.Begin()
	if err != nil { return err }
	defer tx.Rollback()

	var status, desc string
	err = tx.QueryRow("SELECT status, description FROM loans WHERE id = ?", loanId).Scan(&status, &desc)
	if err != nil { return errors.New("Pinjaman tidak ditemukan") }
	
	var vaultTipe string
	err = tx.QueryRow("SELECT tipe FROM tabungan_brankas WHERE id = ?", req.TargetVaultID).Scan(&vaultTipe)
	if err != nil { return errors.New("Brankas tujuan tidak ditemukan") }
	if vaultTipe != "cash" { return errors.New("Pembayaran cicilan harus masuk ke Brankas Tunai") }

	now := time.Now().UnixMilli()

	// 1. Add Installment Record
	var count int
	tx.QueryRow("SELECT COUNT(*) FROM loan_installments WHERE loan_id = ?", loanId).Scan(&count)
	_, err = tx.Exec(`
		INSERT INTO loan_installments (id, loan_id, installment_number, due_date, principal_amount, total_amount, status, paid_at, payment_method, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'PAID', ?, 'CASH', ?, ?, ?)
	`, cuid2.Generate(), loanId, count+1, now, req.Amount, req.Amount, now, req.Notes, now, now)
	if err != nil { return err }

	// 2. Add to Vault
	_, err = tx.Exec("UPDATE tabungan_brankas SET saldo = saldo + ?, updated_at = ? WHERE id = ?", req.Amount, now, req.TargetVaultID)
	if err != nil { return err }

	// 3. Log Vault Tx
	_, err = tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		cuid2.Generate(), "setor_ke_bank", int(req.Amount), userId, fmt.Sprintf("Pembayaran pinjaman %s (%s)", desc, loanId), now)
	if err != nil { return err }

	return tx.Commit()
}

func (r *LoanRepository) RejectLoan(loanId string, reason string) error {
	_, err := r.DB.Exec("UPDATE loans SET status = 'REJECTED', rejection_reason = ?, updated_at = ? WHERE id = ?",
		reason, time.Now().UnixMilli(), loanId)
	return err
}
