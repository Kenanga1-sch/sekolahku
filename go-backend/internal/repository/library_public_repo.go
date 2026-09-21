package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/sekolahku/go-backend/internal/models"
)

// PublicLibraryRepository handles read-only queries for public-facing features
type PublicLibraryRepository struct {
	DB *sql.DB
}

func NewPublicLibraryRepository(db *sql.DB) *PublicLibraryRepository {
	return &PublicLibraryRepository{DB: db}
}

// GetBooksForPublic returns paginated book list with availability info for public browsing
func (r *PublicLibraryRepository) GetBooksForPublic(page, perPage int, search, category string) ([]models.BookWithAvailability, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50 // Public gets more items per page since it's read-only
	}
	offset := (page - 1) * perPage

	where := "WHERE 1=1"
	args := []interface{}{}

	search = strings.TrimSpace(search)
	if search != "" {
		where += " AND (c.title LIKE ? OR c.author LIKE ? OR COALESCE(c.isbn,'') LIKE ?)"
		like := "%" + search + "%"
		args = append(args, like, like, like)
	}

	category = strings.TrimSpace(category)
	if category != "" && category != "all" {
		where += " AND c.category = ?"
		args = append(args, category)
	}

	// Count total matching books (by unique catalog entries, not individual assets)
	countQuery := `SELECT COUNT(DISTINCT c.id) FROM library_assets a JOIN library_catalog c ON a.catalog_id = c.id ` + where
	var total int
	if err := r.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Query with availability counts using GROUP BY
	query := `
		SELECT 
			DISTINCT a.id, a.catalog_id,
			COALESCE(c.title, ''),
			COALESCE(c.author, ''),
			COALESCE(c.isbn, ''),
			COALESCE(c.publisher, ''),
			COALESCE(c.year, 0),
			c.category,
			COALESCE(c.description, ''),
			COALESCE(c.cover, ''),
			a.status, a.location, a.condition,
			a.created_at, a.updated_at,
			SUM(CASE WHEN a.status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_count,
			COUNT(*) as total_exemplars
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		` + where + `
		GROUP BY c.id, a.id, a.status, a.location, a.condition, a.created_at, a.updated_at
		ORDER BY c.title ASC
		LIMIT ? OFFSET ?
	`
	listArgs := append(args, perPage, offset)

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var books []models.BookWithAvailability
	for rows.Next() {
		var b models.BookWithAvailability
		var yr, availCount, totalCounts sql.NullInt64
		var loc, cond, pub, desc, cover sql.NullString

		if err := rows.Scan(
			&b.ID, &b.CatalogID, &b.Title, &b.Author, &b.ISBN,
			&pub, &yr, &b.Category, &desc, &cover,
			&b.Status, &loc, &cond, &b.CreatedAt, &b.UpdatedAt,
			&availCount, &totalCounts,
		); err != nil {
			return nil, 0, err
		}

		if pub.Valid { b.Publisher = pub.String } else { b.Publisher = "" }
		if yr.Valid { b.Year = int(yr.Int64) } else { b.Year = 0 }
		if desc.Valid { b.Description = desc.String } else { b.Description = "" }
		if cover.Valid { b.Cover = cover.String } else { b.Cover = "" }
		if loc.Valid { b.Location = loc.String } else { b.Location = "" }
		if cond.Valid { b.Condition = cond.String } else { b.Condition = "" }
		if availCount.Valid { b.AvailableCount = int(availCount.Int64) } else { b.AvailableCount = 0 }
		if totalCounts.Valid { b.TotalExemplars = int(totalCounts.Int64) } else { b.TotalExemplars = 0 }

		books = append(books, b)
	}

	if books == nil {
		books = []models.BookWithAvailability{}
	}
	return books, total, nil
}

// GetBookDetail retrieves full details for a single book by asset ID or catalog ID
func (r *PublicLibraryRepository) GetBookDetail(id string) (*models.BookWithAvailability, error) {
	query := `
		SELECT 
			a.id, a.catalog_id,
			COALESCE(c.title, ''),
			COALESCE(c.author, ''),
			COALESCE(c.isbn, ''),
			COALESCE(c.publisher, ''),
			COALESCE(c.year, 0),
			c.category,
			COALESCE(c.description, ''),
			COALESCE(c.cover, ''),
			a.status, a.location, a.condition,
			a.created_at, a.updated_at,
			SUM(CASE WHEN a.status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_count,
			COUNT(*) as total_exemplars
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE a.id = ? OR c.id = ?
		GROUP BY c.id, a.id, a.status, a.location, a.condition, a.created_at, a.updated_at
	`

	var b models.BookWithAvailability
	var yr, availCount, totalCounts sql.NullInt64
	var loc, cond, pub, desc, cover sql.NullString

	err := r.DB.QueryRow(query, id, id).Scan(
		&b.ID, &b.CatalogID, &b.Title, &b.Author, &b.ISBN,
		&pub, &yr, &b.Category, &desc, &cover,
		&b.Status, &loc, &cond, &b.CreatedAt, &b.UpdatedAt,
		&availCount, &totalCounts,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Not found (no error)
		}
		return nil, err
	}

	if pub.Valid { b.Publisher = pub.String } else { b.Publisher = "" }
	if yr.Valid { b.Year = int(yr.Int64) } else { b.Year = 0 }
	if desc.Valid { b.Description = desc.String } else { b.Description = "" }
	if cover.Valid { b.Cover = cover.String } else { b.Cover = "" }
	if loc.Valid { b.Location = loc.String } else { b.Location = "" }
	if cond.Valid { b.Condition = cond.String } else { b.Condition = "" }
	if availCount.Valid { b.AvailableCount = int(availCount.Int64) } else { b.AvailableCount = 0 }
	if totalCounts.Valid { b.TotalExemplars = int(totalCounts.Int64) } else { b.TotalExemplars = 0 }

	return &b, nil
}

// LibraryStats includes total books and availability summary
type LibraryStats struct {
	TotalBooks      int `json:"totalBooks"`       // Total unique catalog entries
	TotalExemplars  int `json:"totalExemplars"`   // Total physical copies
	AvailableBooks  int `json:"availableBooks"`   // Copies in AVAILABLE status
	BorrowedBooks   int `json:"borrowedBooks"`    // Copies currently borrowed
	CategoriesCount int `json:"categoriesCount"`  // Distinct categories used
}

// GetStats returns public-friendly library statistics
func (r *PublicLibraryRepository) GetStats() (*LibraryStats, error) {
	stats := &LibraryStats{}

	// Total unique catalogs
	r.DB.QueryRow("SELECT COUNT(DISTINCT id) FROM library_catalog").Scan(&stats.TotalBooks)

	// Total exemplars (physical copies)
	r.DB.QueryRow("SELECT COUNT(*) FROM library_assets").Scan(&stats.TotalExemplars)

	// Available copies
	r.DB.QueryRow("SELECT COUNT(*) FROM library_assets WHERE status = 'AVAILABLE'").Scan(&stats.AvailableBooks)

	// Borrowed copies
	r.DB.QueryRow("SELECT COUNT(*) FROM library_assets WHERE status IN ('BORROWED', 'DAMAGED', 'LOST')").Scan(&stats.BorrowedBooks)

	// Distinct categories (excluding empty/UNSORTED if desired)
	r.DB.QueryRow("SELECT COUNT(DISTINCT category) FROM library_catalog WHERE category != ''").Scan(&stats.CategoriesCount)

	return stats, nil
}

// CheckAvailability looks up stock count by ISBN (public lookup without auth)
func (r *PublicLibraryRepository) CheckAvailability(isbn string) (*ISBNAvailabilityResult, error) {
	isbn = strings.TrimSpace(isbn)
	if isbn == "" {
		return nil, errors.New("ISBN wajib diisi")
	}

	var catalogID string
	err := r.DB.QueryRow("SELECT id FROM library_catalog WHERE isbn = ? LIMIT 1", isbn).Scan(&catalogID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Not found in local catalog (but no error)
		}
		return nil, err
	}

	// Get availability summary for this ISBN's catalog entry
	query := `
		SELECT 
			c.title, c.author, c.publisher, c.year, c.category,
			COALESCE(c.description, ''),
			COALESCE(c.cover, ''),
			SUM(CASE WHEN a.status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_count,
			COUNT(*) as total_exemplars
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE c.isbn = ?
		GROUP BY c.id, c.title, c.author, c.publisher, c.year, c.category, c.description, c.cover
	`

	var result ISBNAvailabilityResult
	var yr, availCount, totalCounts sql.NullInt64
	var title, author, pub, cat, desc, cover sql.NullString

	err = r.DB.QueryRow(query, isbn).Scan(
		&title, &author, &pub, &yr, &cat,
		&desc, &cover, &availCount, &totalCounts,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	result.ISBN = isbn
	if title.Valid { result.Title = title.String }
	if author.Valid { result.Author = author.String }
	if pub.Valid { result.Publisher = pub.String }
	if yr.Valid { result.Year = int(yr.Int64) }
	if cat.Valid { result.Category = cat.String }
	if desc.Valid { result.Description = desc.String }
	if cover.Valid { result.Cover = cover.String }
	if availCount.Valid { result.AvailableCount = int(availCount.Int64) }
	if totalCounts.Valid { result.TotalExemplars = int(totalCounts.Int64) }

	return &result, nil
}

// ISBNAvailabilityResult is the response for availability lookup by ISBN
type ISBNAvailabilityResult struct {
	Title          string `json:"title"`
	Author         string `json:"author"`
	Publisher      string `json:"publisher"`
	Year           int    `json:"year"`
	Category       string `json:"category"`
	Description    string `json:"description"`
	Cover          string `json:"cover"`
	ISBN           string `json:"isbn"`
	AvailableCount int    `json:"availableCount"`
	TotalExemplars int    `json:"totalExemplars"`
}
