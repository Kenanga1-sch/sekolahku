package repository

import (
	"database/sql"
	"errors"

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
	settingsQuery := `SELECT id, school_name, school_address, school_phone, school_email, school_website, school_logo, spmb_is_open, current_academic_year FROM school_settings LIMIT 1`
	var s models.SchoolSettings
	var open sql.NullInt64
	var logo, site, email, phone, addr, year sql.NullString
	err := r.DB.QueryRow(settingsQuery).Scan(&s.ID, &s.SchoolName, &addr, &phone, &email, &site, &logo, &open, &year)
	if err == nil {
		if addr.Valid { s.SchoolAddress = &addr.String }
		if phone.Valid { s.SchoolPhone = &phone.String }
		if email.Valid { s.SchoolEmail = &email.String }
		if site.Valid { s.SchoolWebsite = &site.String }
		if logo.Valid { s.SchoolLogo = &logo.String }
		if open.Valid { s.SPMBIsOpen = open.Int64 != 0 }
		if year.Valid { s.CurrentAcademicYear = year.String }
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
				if excerpt.Valid { a.Excerpt = &excerpt.String }
				if category.Valid { a.Category = &category.String }
				if thumbnail.Valid { a.Thumbnail = &thumbnail.String }
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
		SELECT id, name, academic_year, start_date, end_date, quota, status
		FROM spmb_periods
		WHERE status = 'active'
		LIMIT 1
	`).Scan(&p.ID, &p.Name, &p.AcademicYear, &sd, &ed, &p.Quota, &p.Status)
	if err == nil {
		p.StartDate = SafeTime(sd)
		p.EndDate = SafeTime(ed)
		p.IsActive = true
		data.ActivePeriod = &p
	} else if !errors.Is(err, sql.ErrNoRows) {
		// Log error if needed
	}

	// 4. Student Count
	r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE status = 'active'").Scan(&data.Stats.StudentCount)

	return data, nil
}

func (r *PublicRepository) GetPublicStaff() ([]models.PublicStaff, error) {
	query := `
		SELECT u.id, u.name, u.is_active, u.image, 
		       e.category, e.degree, e.job_type, e.quote
		FROM users u
		JOIN employee_details e ON u.id = e.user_id
		WHERE u.is_active = 1
		ORDER BY 
			CASE WHEN e.category = 'kepsek' THEN 0 ELSE 1 END,
			u.name ASC
	`
	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var staff []models.PublicStaff
	for rows.Next() {
		var s models.PublicStaff
		var img, cat, deg, job, quote sql.NullString
		var isActive bool

		err := rows.Scan(&s.ID, &s.Name, &isActive, &img, &cat, &deg, &job, &quote)
		if err != nil {
			return nil, err
		}

		s.IsActive = isActive
		if img.Valid { s.PhotoURL = img.String }
		if cat.Valid { s.Category = cat.String }
		if deg.Valid { s.Degree = deg.String }
		if job.Valid { s.Position = job.String }
		if quote.Valid { s.Quote = quote.String }

		staff = append(staff, s)
	}

	if staff == nil {
		staff = []models.PublicStaff{}
	}

	return staff, nil
}

func (r *PublicRepository) GetPublicGallery(category string) ([]models.GalleryItem, error) {
	query := "SELECT id, title, description, category, image_url, public_id, created_at, updated_at FROM galleries WHERE 1=1"
	args := []interface{}{}

	if category != "" && category != "all" {
		query += " AND category = ?"
		args = append(args, category)
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.GalleryItem
	for rows.Next() {
		var item models.GalleryItem
		var desc, pubID sql.NullString
		var crAt, upAt sql.NullInt64

		err := rows.Scan(&item.ID, &item.Title, &desc, &item.Category, &item.ImageUrl, &pubID, &crAt, &upAt)
		if err != nil {
			return nil, err
		}

		if desc.Valid { item.Description = &desc.String }
		if pubID.Valid { item.PublicID = &pubID.String }
		item.CreatedAt = SafeTime(crAt)
		item.UpdatedAt = SafeTime(upAt)
		
		items = append(items, item)
	}

	if items == nil {
		items = []models.GalleryItem{}
	}

	return items, nil
}

