package models

import "time"

type Loan struct {
	ID                string     `json:"id"`
	EmployeeDetailID  *string    `json:"employeeDetailId"`
	BorrowerType      string     `json:"borrowerType"` // EMPLOYEE, SCHOOL, EXTERNAL
	BorrowerName      *string    `json:"borrowerName"`
	Description       *string    `json:"description"`
	Type              string     `json:"type"` // KASBON, CICILAN
	AmountRequested   float64    `json:"amountRequested"`
	AmountApproved    *float64   `json:"amountApproved"`
	TenorMonths       int        `json:"tenorMonths"`
	AdminFee          float64    `json:"adminFee"`
	Status            string     `json:"status"` // PENDING, APPROVED, REJECTED, PAID
	RejectionReason   *string    `json:"rejectionReason"`
	Notes             *string    `json:"notes"`
	DisbursedAt       *time.Time `json:"disbursedAt"`
	CreatedAt         *time.Time `json:"createdAt"`
	UpdatedAt         *time.Time `json:"updatedAt"`

	// Relations
	Employee     *Employee         `json:"employee,omitempty"`
	Installments []LoanInstallment `json:"installments,omitempty"`
	PaidAmount   float64           `json:"paidAmount"`
	RemainingAmount float64        `json:"remainingAmount"`
}

type LoanInstallment struct {
	ID                string     `json:"id"`
	LoanID            string     `json:"loanId"`
	InstallmentNumber int        `json:"installmentNumber"`
	DueDate           *time.Time `json:"dueDate"`
	PrincipalAmount   float64    `json:"principalAmount"`
	InterestAmount    float64    `json:"interestAmount"`
	TotalAmount       float64    `json:"totalAmount"`
	Status            string     `json:"status"` // UNPAID, PAID
	PaidAt            *time.Time `json:"paidAt"`
	PaymentMethod     *string    `json:"paymentMethod"`
	Notes             *string    `json:"notes"`
	CreatedAt         *time.Time `json:"createdAt"`
}

type CreateLoanRequest struct {
	BorrowerType     string  `json:"borrowerType"`
	EmployeeDetailID *string `json:"employeeDetailId,omitempty"`
	BorrowerName     *string `json:"borrowerName,omitempty"`
	Description      *string `json:"description,omitempty"`
	Type             string  `json:"type"`
	AmountRequested  float64 `json:"amountRequested"`
	TenorMonths      int     `json:"tenorMonths"`
	Notes            *string `json:"notes,omitempty"`
}

type ApproveLoanRequest struct {
	ApprovedAmount float64 `json:"approvedAmount"`
	SourceVaultID  string  `json:"sourceVaultId"`
}

type AddPaymentRequest struct {
	Amount        float64 `json:"amount"`
	Notes         *string `json:"notes,omitempty"`
	TargetVaultID string  `json:"targetVaultId"`
}
