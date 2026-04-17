package models

import "time"

// LibraryCatalog represents a bibliographic record
type LibraryCatalog struct {
	ID          string     `json:"id"`
	Isbn        *string    `json:"isbn"`
	Title       string     `json:"title"`
	Author      *string    `json:"author"`
	Publisher   *string    `json:"publisher"`
	Year        *int       `json:"year"`
	Category    string     `json:"category"`
	Description *string    `json:"description"`
	Cover       *string    `json:"cover"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

// LibraryAsset represents a physical book/item
type LibraryAsset struct {
	ID        string     `json:"id"`
	CatalogID string     `json:"catalogId"`
	Status    string     `json:"status"` // "AVAILABLE", "BORROWED", "DAMAGED", "LOST"
	Location  *string    `json:"location"`
	Condition *string    `json:"condition"`
	CreatedAt *time.Time `json:"createdAt"`
	UpdatedAt *time.Time `json:"updatedAt"`
}

// LibraryMember represents a library user
type LibraryMember struct {
	ID             string     `json:"id"`
	UserID         *string    `json:"userId"`
	StudentID      *string    `json:"studentId"`
	Name           string     `json:"name"`
	ClassName      *string    `json:"className"`
	QrCode         string     `json:"qrCode"`
	MaxBorrowLimit int        `json:"maxBorrowLimit"`
	Photo          *string    `json:"photo"`
	IsActive       bool       `json:"isActive"`
	CreatedAt      *time.Time `json:"createdAt"`
	UpdatedAt      *time.Time `json:"updatedAt"`
}

// LibraryLoan represents a borrowing record
type LibraryLoan struct {
	ID         string     `json:"id"`
	MemberID   string     `json:"memberId"`
	ItemID     string     `json:"itemId"` // This matches the Asset QR Code
	BorrowDate time.Time  `json:"borrowDate"`
	DueDate    time.Time  `json:"dueDate"`
	ReturnDate *time.Time `json:"returnDate"`
	IsReturned bool       `json:"isReturned"`
	FineAmount int        `json:"fineAmount"`
	FinePaid   bool       `json:"finePaid"`
	Notes      *string    `json:"notes"`
	CreatedAt  *time.Time `json:"createdAt"`
	UpdatedAt  *time.Time `json:"updatedAt"`
}

// LibraryStats represents summary data for the dashboard
type LibraryStats struct {
	TotalBooks     int `json:"totalBooks"`
	AvailableBooks int `json:"availableBooks"`
	BorrowedBooks  int `json:"borrowedBooks"`
	TotalMembers   int `json:"totalMembers"`
	ActiveLoans    int `json:"activeLoans"`
	OverdueLoans   int `json:"overdueLoans"`
	TodayVisits    int `json:"todayVisits"`
}

// StatsResponse matches frontend expectation
type LibraryStatsResponse struct {
	Success bool          `json:"success"`
	Data    *LibraryStats `json:"data"`
}
