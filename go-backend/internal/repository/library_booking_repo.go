package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// LibraryBookingRepository handles booking operations
type LibraryBookingRepository struct {
	DB *sql.DB
}

func NewLibraryBookingRepository(db *sql.DB) *LibraryBookingRepository {
	return &LibraryBookingRepository{DB: db}
}

// CreateBooking creates a new book reservation
func (r *LibraryBookingRepository) CreateBooking(input models.CreateBookingRequest, userID string) (*models.LibraryBooking, error) {
	assetID := input.AssetID
	if assetID == "" {
		return nil, errors.New("asset ID wajib diisi")
	}

	catalogID := ""
	now := UnixMilli()

	// Check if asset exists
	var exists int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = ?", assetID).Scan(&exists); err != nil {
		return nil, err
	}
	if exists == 0 {
		return nil, errors.New("buku tidak ditemukan")
	}

	// Get catalog_id for this asset
	if err := r.DB.QueryRow("SELECT catalog_id FROM library_assets WHERE id = ?", assetID).Scan(&catalogID); err != nil {
		return nil, err
	}

	bookingID := cuid2.Generate()
	expiresAt := int64(0) // Auto-expires after N days from borrowDate (implemented later)

	_, err := r.DB.Exec(`
		INSERT INTO library_bookings (
			id, user_id, member_id, asset_id, catalog_id,
			borrower_name, borrower_email, borrower_phone, student_class,
			borrow_date, due_date, expires_at, status, notes, created_at, updated_at
		) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, bookingID, userID, assetID, catalogID,
		input.BorrowerName,
		input.BorrowerEmail,
		input.BorrowerPhone,
		input.StudentClass,
		input.BorrowDate,
		input.DueDate,
		expiresAt,
		models.BookingStatusPending,
		input.Notes,
		now, now)

	if err != nil {
		return nil, err
	}

	return r.GetBookingByID(bookingID)
}

// GetMyBookings retrieves bookings for authenticated user
func (r *LibraryBookingRepository) GetMyBookings(userID string, page, perPage int) ([]models.LibraryBooking, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	// Count total
	var total int
	err := r.DB.QueryRow(
		"SELECT COUNT(*) FROM library_bookings WHERE user_id = ?",
		userID,
	).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT 
			b.id, b.user_id, b.member_id, b.asset_id, b.catalog_id,
			b.borrower_name, b.borrower_email, b.borrower_phone, b.student_class,
			b.borrow_date, b.due_date, b.expires_at, b.status, b.notes,
			b.created_at, b.updated_at,
			a.id as asset_id_short, ac.title as item_title, ac.cover,
			u.name as member_name, u.class_name as member_class
		FROM library_bookings b
		JOIN library_assets a ON b.asset_id = a.id
		JOIN library_catalog ac ON b.catalog_id = ac.id
		LEFT JOIN library_members u ON b.member_id = u.id
		WHERE b.user_id = ?
		ORDER BY b.created_at DESC
		LIMIT ? OFFSET ?
	`

	rows, err := r.DB.Query(query, userID, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var bookings []models.LibraryBooking
	for rows.Next() {
		var booking models.LibraryBooking
		var yr, due, exp sql.NullInt64
		var email, phone, class sql.NullString

		if err := rows.Scan(
			&booking.ID, &booking.UserID, &booking.MemberID, &booking.AssetID, &booking.CatalogID,
			&booking.BorrowerName, &email, &phone, &class,
			&yr, &due, &exp, &booking.Status, &booking.Notes,
			&booking.CreatedAt, &booking.UpdatedAt,
			&booking.Item.ID, &booking.Item.Title, &booking.Item.Cover,
			&booking.BorrowerInfo.Name, &booking.BorrowerInfo.ClassName,
		); err != nil {
			continue
		}

		if email.Valid { booking.BorrowerEmail = &email.String }
		if phone.Valid { booking.BorrowerPhone = &phone.String }
		if class.Valid { booking.StudentClass = &class.String }
		if yr.Valid { booking.BorrowDate = time.UnixMilli(yr.Int64) }
		if due.Valid { booking.DueDate = time.UnixMilli(due.Int64) }
		if exp.Valid && exp.Int64 > 0 {
			t := time.UnixMilli(exp.Int64)
			booking.ExpiresAt = &t
		}

		bookings = append(bookings, booking)
	}

	if bookings == nil {
		bookings = []models.LibraryBooking{}
	}
	return bookings, total, nil
}

// GetBookingByID retrieves a single booking by ID
func (r *LibraryBookingRepository) GetBookingByID(id string) (*models.LibraryBooking, error) {
	query := `
		SELECT 
			b.id, b.user_id, b.member_id, b.asset_id, b.catalog_id,
			b.borrower_name, b.borrower_email, b.borrower_phone, b.student_class,
			b.borrow_date, b.due_date, b.expires_at, b.status, b.notes,
			b.created_at, b.updated_at,
			a.id as asset_id_short, ac.title as item_title, ac.cover,
			u.name as member_name, u.class_name as member_class
		FROM library_bookings b
		JOIN library_assets a ON b.asset_id = a.id
		JOIN library_catalog ac ON b.catalog_id = ac.id
		LEFT JOIN library_members u ON b.member_id = u.id
		WHERE b.id = ?
	`

	var booking models.LibraryBooking
	var yr, due, exp sql.NullInt64
	var email, phone, class sql.NullString

	err := r.DB.QueryRow(query, id).Scan(
		&booking.ID, &booking.UserID, &booking.MemberID, &booking.AssetID, &booking.CatalogID,
		&booking.BorrowerName, &email, &phone, &class,
		&yr, &due, &exp, &booking.Status, &booking.Notes,
		&booking.CreatedAt, &booking.UpdatedAt,
		&booking.Item.ID, &booking.Item.Title, &booking.Item.Cover,
		&booking.BorrowerInfo.Name, &booking.BorrowerInfo.ClassName,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if email.Valid { booking.BorrowerEmail = &email.String }
	if phone.Valid { booking.BorrowerPhone = &phone.String }
	if class.Valid { booking.StudentClass = &class.String }
	if yr.Valid { booking.BorrowDate = time.UnixMilli(yr.Int64) }
	if due.Valid { booking.DueDate = time.UnixMilli(due.Int64) }
	if exp.Valid && exp.Int64 > 0 {
		t := time.UnixMilli(exp.Int64)
		booking.ExpiresAt = &t
	}

	return &booking, nil
}

// CancelBooking cancels an existing booking
func (r *LibraryBookingRepository) CancelBooking(id string, reason *string) error {
	res, err := r.DB.Exec(`
		UPDATE library_bookings 
		SET status = 'cancelled', notes = COALESCE(?, notes), updated_at = ?
		WHERE id = ? AND status IN ('pending', 'confirmed')
	`, reason, UnixMilli(), id)

	if err != nil {
		return err
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("tidak dapat membatalkan booking - status tidak valid atau booking tidak ditemukan")
	}

	return nil
}

// ConfirmBooking - Librarian confirms the booking
func (r *LibraryBookingRepository) ConfirmBooking(id string) error {
	_, err := r.DB.Exec(`
		UPDATE library_bookings 
		SET status = 'confirmed', updated_at = ?
		WHERE id = ? AND status = 'pending'
	`, UnixMilli(), id)
	return err
}

// MarkAsReady - Librarian marks booking as ready for pickup
func (r *LibraryBookingRepository) MarkAsReady(id string) error {
	_, err := r.DB.Exec(`
		UPDATE library_bookings 
		SET status = 'ready', updated_at = ?
		WHERE id = ? AND status = 'confirmed'
	`, UnixMilli(), id)
	return err
}
