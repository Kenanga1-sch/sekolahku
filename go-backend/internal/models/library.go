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

type ISBNLookupResponse struct {
	ID             string   `json:"id,omitempty"`
	Title          string   `json:"title"`
	Author         string   `json:"author"`
	Publisher      string   `json:"publisher"`
	Year           int64    `json:"year"`
	ISBN           string   `json:"isbn"`
	Cover          string   `json:"cover"`
	CoverURL       string   `json:"coverUrl"`
	Subjects       []string `json:"subjects"`
	DDCCategory    string   `json:"ddcCategory"`
	Category       string   `json:"category"`
	Description    string   `json:"description"`
	LocalFound     bool     `json:"localFound"`
	TotalExemplars int      `json:"totalExemplars"`
	Sources        []string `json:"sources,omitempty"`
}

type CatalogInput struct {
	Title       string `json:"title"`
	Author      string `json:"author"`
	ISBN        string `json:"isbn"`
	Category    string `json:"category"`
	DDCCategory string `json:"ddcCategory"`
	Publisher   string `json:"publisher"`
	Year        int    `json:"year"`
	Description string `json:"description"`
	Cover       string `json:"cover"`
}

type BookDetail struct {
	ID          string              `json:"id"`
	CatalogID   string              `json:"catalogId"`
	Status      string              `json:"status"`
	Location    string              `json:"location"`
	Condition   string              `json:"condition"`
	CreatedAt   time.Time           `json:"createdAt"`
	UpdatedAt   time.Time           `json:"updatedAt"`
	Title       string              `json:"title"`
	Author      string              `json:"author"`
	ISBN        string              `json:"isbn"`
	Publisher   string              `json:"publisher"`
	Year        int                 `json:"year"`
	Category    string              `json:"category"`
	Description string              `json:"description"`
	Cover       string              `json:"cover"`
	Catalog     *LibraryCatalogMini `json:"catalog"`
}

type LibraryCatalogMini struct {
	ID          string  `json:"id"`
	Isbn        string  `json:"isbn"`
	Title       string  `json:"title"`
	Author      string  `json:"author"`
	Publisher   string  `json:"publisher"`
	Year        int     `json:"year"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
	Cover       string  `json:"cover"`
}

type LoanDetail struct {
	ID         string            `json:"id"`
	MemberID   string            `json:"memberId"`
	ItemID     string            `json:"itemId"`
	BorrowDate time.Time         `json:"borrowDate"`
	DueDate    time.Time         `json:"dueDate"`
	ReturnDate time.Time         `json:"returnDate,omitempty"`
	IsReturned bool              `json:"isReturned"`
	FineAmount int               `json:"fineAmount"`
	FinePaid   bool              `json:"finePaid,omitempty"`
	Member     *LoanMemberMini   `json:"member,omitempty"`
	Item       *LoanItemMini     `json:"item,omitempty"`
}

type LoanMemberMini struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ClassName string `json:"className"`
}

type LoanItemMini struct {
	ID       string           `json:"id"`
	Title    string           `json:"title"`
	Category string           `json:"category,omitempty"`
	Catalog  *LoanCatalogMini `json:"catalog,omitempty"`
}

type LoanCatalogMini struct {
	Title    string `json:"title"`
	Category string `json:"category,omitempty"`
}

type VisitDetail struct {
	ID               string    `json:"id"`
	MemberID         string    `json:"memberId,omitempty"`
	GuestName        string    `json:"guestName,omitempty"`
	GuestInstitution string    `json:"guestInstitution,omitempty"`
	GuestPurpose     string    `json:"guestPurpose,omitempty"`
	Date             string    `json:"date"`
	Time             string    `json:"time"`
	CreatedAt        time.Time `json:"createdAt"`
	MemberName       string    `json:"memberName,omitempty"`
	MemberClass      string    `json:"memberClass,omitempty"`
}

type LoanReportItem struct {
	ID          string    `json:"id"`
	MemberName  string    `json:"memberName"`
	MemberClass string    `json:"memberClass"`
	ItemTitle   string    `json:"itemTitle"`
	BorrowDate  time.Time `json:"borrowDate"`
	DueDate     time.Time `json:"dueDate"`
	ReturnDate  time.Time `json:"returnDate,omitempty"`
	IsReturned  bool      `json:"isReturned"`
	FineAmount  int       `json:"fineAmount"`
}

type VisitReportItem struct {
	ID          string    `json:"id"`
	MemberName  string    `json:"memberName"`
	MemberClass string    `json:"memberClass"`
	Date        string    `json:"date"`
	Timestamp   time.Time `json:"timestamp"`
}

type InventoryReport struct {
	Total      int            `json:"total"`
	ByStatus   map[string]int `json:"byStatus"`
	ByCategory map[string]int `json:"byCategory"`
}

type QRBatchItem struct {
	ID            string    `json:"id"`
	Date          string    `json:"date"`
	Prefix        string    `json:"prefix"`
	StartSequence int       `json:"startSequence"`
	EndSequence   int       `json:"endSequence"`
	BatchSize     int       `json:"batchSize"`
	CreatedAt     time.Time `json:"createdAt"`
}

type LoanHistoryItem struct {
	ID         string    `json:"id"`
	ItemID     string    `json:"itemId"`
	Title      string    `json:"title"`
	BorrowDate time.Time `json:"borrowDate"`
	DueDate    time.Time `json:"dueDate"`
	ReturnDate time.Time `json:"returnDate,omitempty"`
	IsReturned bool      `json:"isReturned"`
	FineAmount int       `json:"fineAmount"`
	FinePaid   bool      `json:"finePaid"`
}

type CreateBookRequest struct {
	ISBN        string `json:"isbn"`
	Title       string `json:"title"`
	Author      string `json:"author"`
	Publisher   string `json:"publisher"`
	Year        string `json:"year"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Cover       string `json:"cover"`
	Location    string `json:"location"`
	Copies      int    `json:"copies"`
}

type UpdateMemberRequest struct {
	Name           string `json:"name"`
	ClassName      string `json:"className"`
	StudentID      string `json:"studentId"`
	QRCode         string `json:"qrCode"`
	Photo          string `json:"photo"`
	MaxBorrowLimit int    `json:"maxBorrowLimit"`
	IsActive       *bool  `json:"isActive"`
}

type UpdateBookRequest struct {
	Title       string `json:"title"`
	Author      string `json:"author"`
	ISBN        string `json:"isbn"`
	Publisher   string `json:"publisher"`
	Year        string `json:"year"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Location    string `json:"location"`
}
