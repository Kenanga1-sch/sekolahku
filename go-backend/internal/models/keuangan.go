package models

import "time"

// ===== Modul Keuangan (buku besar generik multi-unit usaha) =====
// Menampung segala jenis keuangan sekolah: sampah plastik, koperasi, kantin, dll.
// Inti: Unit Usaha → Kategori → Transaksi → Saldo. Berdiri sendiri (tidak
// menyentuh brankas tabungan). Uang = int Rupiah.

// FinanceUnit = satu unit usaha (mis. "Sampah Plastik", "Koperasi").
type FinanceUnit struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Type        string    `json:"type"` // generic|sampah|koperasi|kantin|lainnya
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	Color       string    `json:"color"`
	IsActive    bool      `json:"isActive"`
	SortOrder   int       `json:"sortOrder"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`

	// Ringkasan saldo (diisi saat listing, opsional).
	TotalIn  int `json:"totalIn,omitempty"`
	TotalOut int `json:"totalOut,omitempty"`
	Balance  int `json:"balance,omitempty"`
}

// FinanceCategory = kategori pemasukan/pengeluaran milik satu unit.
type FinanceCategory struct {
	ID        string    `json:"id"`
	UnitID    string    `json:"unitId"`
	UnitName  string    `json:"unitName,omitempty"`
	Name      string    `json:"name"`
	Direction string    `json:"direction"` // in|out
	IsActive  bool      `json:"isActive"`
	SortOrder int       `json:"sortOrder"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// FinanceTransaction = satu baris buku besar.
type FinanceTransaction struct {
	ID            string    `json:"id"`
	UnitID        string    `json:"unitId"`
	UnitName      string    `json:"unitName,omitempty"`
	CategoryID    *string   `json:"categoryId,omitempty"`
	CategoryName  string    `json:"categoryName,omitempty"`
	Direction     string    `json:"direction"` // in|out
	Amount        int       `json:"amount"`
	Description   string    `json:"description"`
	TxDate        time.Time `json:"txDate"`
	Party         string    `json:"party"`
	Quantity      *float64  `json:"quantity,omitempty"`
	UnitPrice     *int      `json:"unitPrice,omitempty"`
	Reference     string    `json:"reference"`
	Metadata      string    `json:"metadata,omitempty"`
	CreatedBy     *string   `json:"createdBy,omitempty"`
	CreatedByName string    `json:"createdByName"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// FinanceAuditLog = jejak audit append-only.
type FinanceAuditLog struct {
	ID        string    `json:"id"`
	Entity    string    `json:"entity"`
	EntityID  string    `json:"entityId"`
	Action    string    `json:"action"`
	ActorID   *string   `json:"actorId,omitempty"`
	ActorName string    `json:"actorName"`
	Before    string    `json:"before,omitempty"`
	After     string    `json:"after,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// FinanceSummary = ringkasan saldo satu unit.
type FinanceSummary struct {
	UnitID   string `json:"unitId"`
	UnitName string `json:"unitName"`
	UnitCode string `json:"unitCode"`
	TotalIn  int    `json:"totalIn"`
	TotalOut int    `json:"totalOut"`
	Balance  int    `json:"balance"`
	TxCount  int    `json:"txCount"`
}

// FinanceCategoryRecap = rekap per kategori dalam satu unit.
type FinanceCategoryRecap struct {
	CategoryID string `json:"categoryId"`
	Name       string `json:"name"`
	Direction  string `json:"direction"`
	Total      int    `json:"total"`
	TxCount    int    `json:"txCount"`
}

// FinanceMonthlyRecap = rekap bulanan (periode "YYYY-MM").
type FinanceMonthlyRecap struct {
	Period   string `json:"period"`
	TotalIn  int    `json:"totalIn"`
	TotalOut int    `json:"totalOut"`
	Net      int    `json:"net"`
	TxCount  int    `json:"txCount"`
}

// ==== Request DTOs ====

type CreateFinanceUnitRequest struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	SortOrder   int    `json:"sortOrder"`
	IsActive    *bool  `json:"isActive"`
}

type CreateFinanceCategoryRequest struct {
	UnitID    string `json:"unitId"`
	Name      string `json:"name"`
	Direction string `json:"direction"`
	SortOrder int    `json:"sortOrder"`
	IsActive  *bool  `json:"isActive"`
}

type CreateFinanceTransactionRequest struct {
	UnitID      string   `json:"unitId"`
	CategoryID  string   `json:"categoryId"`
	Direction   string   `json:"direction"`
	Amount      int      `json:"amount"`
	Description string   `json:"description"`
	TxDate      string   `json:"txDate"` // RFC3339 atau epoch-ms string (opsional: default sekarang)
	Party       string   `json:"party"`
	Quantity    *float64 `json:"quantity"`
	UnitPrice   *int     `json:"unitPrice"`
	Reference   string   `json:"reference"`
	Metadata    string   `json:"metadata"`
}
