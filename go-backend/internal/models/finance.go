package models

import "time"

type FinanceAccount struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	AccountNumber *string    `json:"accountNumber"`
	Description   *string    `json:"description"`
	IsSystem      bool       `json:"isSystem"`
	CreatedAt     *time.Time `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt"`
}

type FinanceTransaction struct {
	ID              string     `json:"id"`
	Date            *time.Time `json:"date"`
	Type            string     `json:"type"`
	AccountIDSource *string    `json:"accountIdSource"`
	AccountIDDest   *string    `json:"accountIdDest"`
	CategoryID      *string    `json:"categoryId"`
	Amount          float64    `json:"amount"`
	Description     *string    `json:"description"`
	ProofImage      *string    `json:"proofImage"`
	Status          string     `json:"status"`
	RefTable        *string    `json:"refTable"`
	RefID           *string    `json:"refId"`
	CreatedBy       *string    `json:"createdBy"`
	CreatedAt       *time.Time `json:"createdAt"`
}

type CreateFinanceAccountRequest struct {
	Name           string   `json:"name"`
	AccountNumber  *string  `json:"accountNumber,omitempty"`
	Description    *string  `json:"description,omitempty"`
	InitialBalance float64  `json:"initialBalance,omitempty"`
	CreatedBy      *string  `json:"createdBy,omitempty"`
}
