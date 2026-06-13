package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/sekolahku/go-backend/internal/models"
)

type PublicRepository struct {
	DB *sql.DB
}

func NewPublicRepository(db *sql.DB) *PublicRepository {
	return &PublicRepository{DB: db}
}

func (r *PublicRepository) GetHomepageData() (*models.PublicHomepageData, error) {
	data := &models.PublicHomepageData{
		Success: true,
		News:    []models.Announcement{},
		Stats:   models.PublicStats{},
	}

	// 1. Settings
	settingsQuery := `SELECT id, school_name, school_address, school_phone, school_email, school_website, school_logo, school_lat, school_lng, max_distance_km, spmb_is_open, current_academic_year FROM school_settings LIMIT 1`
	var s models.SchoolSettings
	var open sql.NullInt64
	var logo, site, email, phone, addr, year sql.NullString
	var lat, lng, maxDistance sql.NullFloat64
	err := r.DB.QueryRow(settingsQuery).Scan(&s.ID, &s.SchoolName, &addr, &phone, &email, &site, &logo, &lat, &lng, &maxDistance, &open, &year)
	if err == nil {
		if addr.Valid {
			s.SchoolAddress = &addr.String
		}
		if phone.Valid {
			s.SchoolPhone = &phone.String
		}
		if email.Valid {
			s.SchoolEmail = &email.String
		}
		if site.Valid {
			s.SchoolWebsite = &site.String
		}
		if logo.Valid {
			s.SchoolLogo = &logo.String
		}
		if lat.Valid {
			s.SchoolLat = &lat.Float64
		}
		if lng.Valid {
			s.SchoolLng = &lng.Float64
		}
		if maxDistance.Valid {
			s.MaxDistanceKM = &maxDistance.Float64
		}
		if open.Valid {
			s.SPMBIsOpen = open.Int64 != 0
		}
		if year.Valid {
			s.CurrentAcademicYear = year.String
		}
		data.Settings = &s
	} else {
		// Fallback for empty settings
		dName := "Sekolahku"
		dAddr := "Jl. Pendidikan No. 123"
		dEmail := "info@sekolahku.sch.id"
		data.Settings = &models.SchoolSettings{
			SchoolName:    dName,
			SchoolAddress: &dAddr,
			SchoolEmail:   &dEmail,
		}
	}

	// 2. Latest News
	newsRows, err := r.DB.Query(`
		SELECT id, title, slug, excerpt, category, thumbnail, published_at, created_at
		FROM announcements
		WHERE is_published = 1
		ORDER BY created_at DESC
		LIMIT 4
	`)
	if err == nil {
		defer newsRows.Close()
		for newsRows.Next() {
			var a models.Announcement
			var excerpt, category, thumbnail sql.NullString
			var pAt, crAt sql.NullInt64
			err := newsRows.Scan(&a.ID, &a.Title, &a.Slug, &excerpt, &category, &thumbnail, &pAt, &crAt)
			if err == nil {
				if excerpt.Valid {
					a.Excerpt = &excerpt.String
				}
				if category.Valid {
					a.Category = &category.String
				}
				if thumbnail.Valid {
					a.Thumbnail = &thumbnail.String
				}
				a.PublishedAt = SafeTime(pAt)
				a.CreatedAt = SafeTime(crAt)
				data.News = append(data.News, a)
			}
		}
	}

	// 3. Active SPMB Period
	var p models.SPMBPeriod
	var sd, ed sql.NullInt64
	err = r.DB.QueryRow(`
		SELECT id, name, academic_year, COALESCE(committee_name, ''), start_date, end_date, quota, status
		FROM spmb_periods
		WHERE status = 'active'
		LIMIT 1
	`).Scan(&p.ID, &p.Name, &p.AcademicYear, &p.CommitteeName, &sd, &ed, &p.Quota, &p.Status)
	if err == nil {
		p.StartDate = SafeTime(sd)
		p.EndDate = SafeTime(ed)
		p.IsActive = true
		data.ActivePeriod = &p
	} else if !errors.Is(err, sql.ErrNoRows) {
		// Log error if needed
	}

	// 4. Student Count
	r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE is_active = 1").Scan(&data.Stats.StudentCount)

	return data, nil
}

func (r *PublicRepository) GetPublicStaff(page, perPage int) ([]models.PublicStaff, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM staff_profiles WHERE is_active = 1").Scan(&total)

	query := `
		SELECT id, name, is_active, photo_url,
		       category, degree, position, quote
		FROM staff_profiles
		WHERE is_active = 1
		ORDER BY 
			CASE WHEN category = 'kepsek' THEN 0 ELSE 1 END,
			display_order ASC,
			name ASC
		LIMIT ? OFFSET ?
	`
	rows, err := r.DB.Query(query, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var staff []models.PublicStaff
	for rows.Next() {
		var s models.PublicStaff
		var img, cat, deg, job, quote sql.NullString
		var isActive bool

		err := rows.Scan(&s.ID, &s.Name, &isActive, &img, &cat, &deg, &job, &quote)
		if err != nil {
			return nil, 0, err
		}

		s.IsActive = isActive
		if img.Valid {
			s.PhotoURL = img.String
		}
		if cat.Valid {
			s.Category = cat.String
		}
		if deg.Valid {
			s.Degree = deg.String
		}
		if job.Valid {
			s.Position = job.String
		}
		if quote.Valid {
			s.Quote = quote.String
		}

		staff = append(staff, s)
	}

	if staff == nil {
		staff = []models.PublicStaff{}
	}

	return staff, total, nil
}

func (r *PublicRepository) GetPublicGallery(category string, page, perPage int) ([]models.GalleryItem, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	where := "1=1"
	args := []interface{}{}
	if category != "" && category != "all" {
		where += " AND category = ?"
		args = append(args, category)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM gallery WHERE "+where, args...).Scan(&total)

	listArgs := append(args, perPage, offset)
	query := "SELECT id, title, description, category, image_url, public_id, created_at, updated_at FROM gallery WHERE " + where + " ORDER BY created_at DESC LIMIT ? OFFSET ?"

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []models.GalleryItem
	for rows.Next() {
		var item models.GalleryItem
		var title, category, desc, pubID sql.NullString
		var crAt, upAt sql.NullInt64

		err := rows.Scan(&item.ID, &title, &desc, &category, &item.ImageUrl, &pubID, &crAt, &upAt)
		if err != nil {
			return nil, 0, err
		}

		item.Title = "Foto"
		if title.Valid && strings.TrimSpace(title.String) != "" {
			item.Title = title.String
		}
		item.Category = "lainnya"
		if category.Valid && strings.TrimSpace(category.String) != "" {
			item.Category = category.String
		}
		if desc.Valid {
			item.Description = &desc.String
		}
		if pubID.Valid {
			item.PublicID = &pubID.String
		}
		item.CreatedAt = SafeTime(crAt)
		item.UpdatedAt = SafeTime(upAt)

		items = append(items, item)
	}
	if items == nil {
		items = []models.GalleryItem{}
	}
	return items, total, nil
}

