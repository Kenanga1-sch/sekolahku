package models

import "time"

// LibraryCatalog represents a bibliographic record
type LibraryCatalog struct {
	ID          string  `json:"id"`
	Isbn        *string `json:"isbn,omitempty"`
	Title       string  `json:"title"`
	Author      *string `json:"author,omitempty"`
	Publisher   *string `json:"publisher,omitempty"`
	Year        *int    `json:"year,omitempty"`
	Category    string  `json:"category"`
	Description *string `json:"description,omitempty"`
	Cover       *string `json:"cover,omitempty"`
}

// BookWithAvailability extends BookDetail with stock information for public display
type BookWithAvailability struct {
	ID             string    `json:"id"`
	CatalogID      string    `json:"catalogId"`
	Status         string    `json:"status"`
	Location       string    `json:"location,omitempty"`
	Condition      string    `json:"condition"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
	Title          string    `json:"title"`
	Author         string    `json:"author"`
	ISBN           string    `json:"isbn"`
	Publisher      string    `json:"publisher"`
	Year           int       `json:"year"`
	Category       string    `json:"category"`
	Description    string    `json:"description"`
	Cover          string    `json:"cover"`
	TotalExemplars int       `json:"totalExemplars"` // Total copies in inventory
	AvailableCount int       `json:"availableCount"` // How many are currently AVAILABLE
}

type LibraryCatalogMini struct {
	ID          string  `json:"id"`
	Isbn        *string `json:"isbn,omitempty"`
	Title       string  `json:"title"`
	Author      *string `json:"author,omitempty"`
	Publisher   *string `json:"publisher,omitempty"`
	Year        *int    `json:"year,omitempty"`
	Category    string  `json:"category"`
	Description *string `json:"description,omitempty"`
	Cover       *string `json:"cover,omitempty"`
}

type ISBNLookupResponse struct {
	ID             string   `json:"id,omitempty"`
	Title          string   `json:"title"`
	Author         string   `json:"author"`
	Publisher      string   `json:"publisher"`
	Year           int64    `json:"year"`
	ISBN           string   `json:"isbn,omitempty"`
	Cover          string   `json:"cover,omitempty"`
	CoverURL       string   `json:"coverUrl,omitempty"`
	Subjects       []string `json:"subjects,omitempty"`
	DDCCategory    string   `json:"ddcCategory,omitempty"`
	Category       string   `json:"category,omitempty"`
	Sources        []string `json:"sources,omitempty"`
	LocalFound     bool     `json:"localFound,omitempty"`
	TotalExemplars int      `json:"totalExemplars,omitempty"`
	Description    string   `json:"description,omitempty"`
	// Candidates terisi bila 1 ISBN dipakai N judul berbeda (dedup longgar):
	// tiap kandidat = 1 katalog (id, judul, jumlah eksemplar). Frontend
	// menampilkan picker agar buku tidak nyangkut ke katalog yang salah.
	Candidates []ISBNCandidate `json:"candidates,omitempty"`
}

// ISBNCandidate satu katalog lokal yang memakai ISBN yang sama.
type ISBNCandidate struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	Author         string `json:"author,omitempty"`
	TotalExemplars int    `json:"totalExemplars"`
	// Cover: sampul milik kandidat ini. Satu ISBN boleh dipakai banyak
	// judul, jadi tiap judul punya sampul sendiri dan picker perlu
	// menampilkan sampul yang benar agar tidak tertukar.
	Cover string `json:"cover,omitempty"`
}

// BookSearchResponse adalah hasil pencarian kandidat buku berdasarkan judul
// (agregasi Google Books & Open Library) dengan dukungan paginasi.
type BookSearchResponse struct {
	Results    []ISBNLookupResponse `json:"results"`
	Page       int                  `json:"page"`
	PerPage    int                  `json:"perPage"`
	TotalItems int                  `json:"totalItems"`
	HasMore    bool                 `json:"hasMore"`
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
	EmployeeID     *string    `json:"employeeId"`
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
	// CatalogID: katalog yang dipilih user saat ISBN dipakai banyak judul.
	// Kosong = cocokkan (ISBN + judul) atau buat katalog baru.
	CatalogID string `json:"catalogId,omitempty"`
	// CoverOverwrite: true bila klien JUSTRU mengunggah sampul untuk
	// judul ini pada sesi ini. Tanpa flag ini, sampul milik judul lain
	// tidak boleh ikut tersalin ke judul baru.
	CoverOverwrite bool `json:"coverOverwrite,omitempty"`
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

type LoanDetail struct {
	ID         string          `json:"id"`
	MemberID   string          `json:"memberId"`
	ItemID     string          `json:"itemId"`
	BorrowDate time.Time       `json:"borrowDate"`
	DueDate    time.Time       `json:"dueDate"`
	ReturnDate time.Time       `json:"returnDate,omitempty"`
	IsReturned bool            `json:"isReturned"`
	FineAmount int             `json:"fineAmount"`
	FinePaid   bool            `json:"finePaid,omitempty"`
	Member     *LoanMemberMini `json:"member,omitempty"`
	Item       *LoanItemMini   `json:"item,omitempty"`
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

// LoanReportResult membungkus daftar laporan peminjaman BERSAMA jumlah total
// yang sebenarnya, bukan sekadar banyak baris yang dikembalikan.
//
// Alasannya: laporan dulu dibatasi 1000 baris dan hanya mengembalikan array.
// Frontend lalu menulis "Total Transaksi: 1000" seolah itu seluruh data,
// padahal sisanya terpotong tanpa tanda apa pun. Dengan totalItems, klien
// bisa menelusuri halaman atau setidaknya memperingatkan pemakai.
type LoanReportResult struct {
	Items      []LoanReportItem `json:"items"`
	TotalItems int              `json:"totalItems"`
}

// VisitReportResult padanan LoanReportResult untuk laporan kunjungan.
type VisitReportResult struct {
	Items      []VisitReportItem `json:"items"`
	TotalItems int               `json:"totalItems"`
}

// OverdueReportResult membungkus daftar keterlambatan.
//
// Dulu GetOverdueReport meminta 1000 baris ke GetLoans, tetapi GetLoans
// memotong perPage ke 100 — jadi laporan keterlambatan maksimal 100 baris
// tanpa peringatan. Kini diambil berhalaman dan totalnya ikut dikembalikan.
type OverdueReportResult struct {
	Items      []LoanDetail `json:"items"`
	TotalItems int          `json:"totalItems"`
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

// StickerPreset adalah tata letak stiker QR yang disimpan operator.
// Semua ukuran dalam milimeter. Dibagi ke semua akun admin.
type StickerPreset struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	PaperWidth  float64 `json:"paperWidth"`
	PaperHeight float64 `json:"paperHeight"`
	LabelWidth  float64 `json:"labelWidth"`
	LabelHeight float64 `json:"labelHeight"`
	GapX        float64 `json:"gapX"`
	GapY        float64 `json:"gapY"`
	FontSize    float64 `json:"fontSize"`
	// CreatedBy menyimpan users.id pembuat; CreatedByName hasil JOIN users.name
	// untuk ditampilkan di UI.
	CreatedBy     string `json:"createdBy,omitempty"`
	CreatedByName string `json:"createdByName,omitempty"`
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
	Year        *int   `json:"year"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Cover       string `json:"cover"`
	Copies      int    `json:"copies"`   // Number of physical copies to create (default 1)
	Location    string `json:"location"` // Shelf location for new assets
}

// BookUpdateRequest handles partial updates with optional Year field
type UpdateBookRequest struct {
	ISBN        string  `json:"isbn"`
	Title       string  `json:"title"`
	Author      *string `json:"author,omitempty"`
	Publisher   *string `json:"publisher,omitempty"`
	Year        *int    `json:"year,omitempty"`
	Category    string  `json:"category"`
	Description *string `json:"description,omitempty"`
	Cover       *string `json:"cover,omitempty"`
	Location    string  `json:"location"`
}

// LibraryBooking represents a book reservation request
type LibraryBooking struct {
	ID            string        `json:"id"`
	UserID        *string       `json:"userId,omitempty"`
	MemberID      *string       `json:"memberId,omitempty"`
	AssetID       string        `json:"assetId"`
	CatalogID     string        `json:"catalogId"`
	BorrowerName  string        `json:"borrowerName"`
	BorrowerEmail *string       `json:"borrowerEmail,omitempty"`
	BorrowerPhone *string       `json:"borrowerPhone,omitempty"`
	StudentClass  *string       `json:"studentClass,omitempty"`
	BorrowDate    time.Time     `json:"borrowDate"`
	DueDate       time.Time     `json:"dueDate"`
	ExpiresAt     *time.Time    `json:"expiresAt,omitempty"`
	Status        BookingStatus `json:"status"`
	Notes         *string       `json:"notes,omitempty"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`

	// Expanded relations
	Item         *LibraryAssetMini `json:"item,omitempty"`
	BorrowerInfo *BorrowerInfo     `json:"borrowerInfo,omitempty"`
}

type LibraryAssetMini struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Cover string `json:"cover"`
}

type BorrowerInfo struct {
	Name      string  `json:"name"`
	Email     *string `json:"email,omitempty"`
	Phone     *string `json:"phone,omitempty"`
	ClassName *string `json:"className,omitempty"`
}

// BookingStatus enumeration for reservation states
type BookingStatus string

const (
	BookingStatusPending   BookingStatus = "pending"   // Initial state, awaiting confirmation
	BookingStatusConfirmed BookingStatus = "confirmed" // Librarian confirmed the booking
	BookingStatusReady     BookingStatus = "ready"     // Book is prepared for pickup
	BookingStatusCompleted BookingStatus = "completed" // Borrower picked up the book
	BookingStatusCancelled BookingStatus = "cancelled" // Booking cancelled by user or admin
	BookingStatusExpired   BookingStatus = "expired"   // Auto-expired due to no pickup
)

// CreateBookingRequest represents input for creating a new booking
type CreateBookingRequest struct {
	AssetID       string  `json:"assetId"`
	BorrowDate    int64   `json:"borrowDate"` // Unix milliseconds
	DueDate       int64   `json:"dueDate"`    // Unix milliseconds
	BorrowerName  string  `json:"borrowerName"`
	BorrowerEmail *string `json:"borrowerEmail,omitempty"`
	BorrowerPhone *string `json:"borrowerPhone,omitempty"`
	StudentClass  *string `json:"studentClass,omitempty"`
	Notes         *string `json:"notes,omitempty"`
}

// UpdateBookingStatusRequest for confirming/canceling bookings
type UpdateBookingStatusRequest struct {
	Status BookingStatus `json:"status"`
	Notes  *string       `json:"notes,omitempty"`
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
