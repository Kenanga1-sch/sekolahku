package models

import "time"

type FinanceAccount struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	AccountNumber *string    `json:"accountNumber"`
	Description   *string    `json:"description"`
	Balance       float64    `json:"balance"`
	IsSystem      bool       `json:"isSystem"`
	CreatedAt     *time.Time `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt"`
}

type FinanceCategory struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Type        string     `json:"type"` // INCOME, EXPENSE
	Description *string    `json:"description"`
	IsSystem    bool       `json:"isSystem"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

type FinanceTransaction struct {
	ID              string     `json:"id"`
	Date            *time.Time `json:"date"`
	Type            string     `json:"type"` // INCOME, EXPENSE, TRANSFER
	AccountIDSource *string    `json:"accountIdSource"`
	AccountIDDest   *string    `json:"accountIdDest"`
	CategoryID      *string    `json:"categoryId"`
	Amount          float64    `json:"amount"`
	Description     *string    `json:"description"`
	ProofImage      *string    `json:"proofImage"`
	Status          string     `json:"status"` // PENDING, APPROVED, REJECTED
	RefTable        *string    `json:"refTable"`
	RefID           *string    `json:"refId"`
	CreatedBy       *string    `json:"createdBy"`
	CreatedAt       *time.Time `json:"createdAt"`

	// Relations for response
	AccountSource *FinanceAccount  `json:"accountSource,omitempty"`
	AccountDest   *FinanceAccount  `json:"accountDest,omitempty"`
	Category      *FinanceCategory `json:"category,omitempty"`
}

type FinanceStats struct {
	TotalBalance float64 `json:"totalBalance"`
	IncomeMonth  float64 `json:"incomeMonth"`
	ExpenseMonth float64 `json:"expenseMonth"`
	PendingCount int     `json:"pendingCount"`
}

type CreateFinanceAccountRequest struct {
	Name           string  `json:"name"`
	AccountNumber  *string `json:"accountNumber,omitempty"`
	Description    *string `json:"description,omitempty"`
	InitialBalance float64 `json:"initialBalance,omitempty"`
	CreatedBy      *string `json:"createdBy,omitempty"`
}

type CreateFinanceCategoryRequest struct {
	Name        string  `json:"name"`
	Type        string  `json:"type"` // INCOME, EXPENSE
	Description *string `json:"description,omitempty"`
}

type CreateFinanceTransactionRequest struct {
	Date            *time.Time `json:"date"`
	Type            string     `json:"type"`
	AccountIDSource string     `json:"accountIdSource"`
	AccountIDDest   *string    `json:"accountIdDest,omitempty"`
	CategoryID      *string    `json:"categoryId,omitempty"`
	Amount          float64    `json:"amount"`
	Description     *string    `json:"description,omitempty"`
	ProofImage      *string    `json:"proofImage,omitempty"`
	Status          *string    `json:"status,omitempty"`
	CreatedBy       *string    `json:"createdBy,omitempty"`
}

type FinanceTransactionFilters struct {
	AccountID string
	StartDate *time.Time
	EndDate   *time.Time
	Type      string
	Status    string
	Sort      string
	Limit     int
}
