package repository

import (
	"database/sql"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type StaffProfileRepository struct {
	DB *sql.DB
}

func NewStaffProfileRepository(db *sql.DB) *StaffProfileRepository {
	return &StaffProfileRepository{DB: db}
}

func (r *StaffProfileRepository) GetProfiles(search string) ([]models.StaffProfile, error) {
	query := "SELECT id, name, degree, position, category, photo_url, nip, quote, display_order, is_active, created_at, updated_at FROM staff_profiles WHERE 1=1"
	var args []interface{}

	if search != "" {
		query += " AND (name LIKE ? OR position LIKE ? OR nip LIKE ?)"
		likeQ := "%" + search + "%"
		args = append(args, likeQ, likeQ, likeQ)
	}

	query += " ORDER BY display_order ASC, name ASC"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var profiles []models.StaffProfile
	for rows.Next() {
		var p models.StaffProfile
		var deg, photo, nip, quote sql.NullString
		var crAt, upAt sql.NullInt64

		err := rows.Scan(
			&p.ID, &p.Name, &deg, &p.Position, &p.Category, &photo,
			&nip, &quote, &p.DisplayOrder, &p.IsActive, &crAt, &upAt,
		)
		if err != nil {
			return nil, err
		}

		if deg.Valid {
			p.Degree = &deg.String
		}
		if photo.Valid {
			p.PhotoUrl = &photo.String
		}
		if nip.Valid {
			p.NIP = &nip.String
		}
		if quote.Valid {
			p.Quote = &quote.String
		}

		cTime := ToTime(crAt)
		p.CreatedAt = &cTime
		uTime := ToTime(upAt)
		p.UpdatedAt = &uTime

		profiles = append(profiles, p)
	}
	if profiles == nil {
		profiles = []models.StaffProfile{}
	}
	return profiles, nil
}

func (r *StaffProfileRepository) GetByID(id string) (*models.StaffProfile, error) {
	query := "SELECT id, name, degree, position, category, photo_url, nip, quote, display_order, is_active, created_at, updated_at FROM staff_profiles WHERE id = ?"

	var p models.StaffProfile
	var deg, photo, nip, quote sql.NullString
	var crAt, upAt sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&p.ID, &p.Name, &deg, &p.Position, &p.Category, &photo,
		&nip, &quote, &p.DisplayOrder, &p.IsActive, &crAt, &upAt,
	)
	if err != nil {
		return nil, err
	}

	if deg.Valid {
		p.Degree = &deg.String
	}
	if photo.Valid {
		p.PhotoUrl = &photo.String
	}
	if nip.Valid {
		p.NIP = &nip.String
	}
	if quote.Valid {
		p.Quote = &quote.String
	}

	cTime := ToTime(crAt)
	p.CreatedAt = &cTime
	uTime := ToTime(upAt)
	p.UpdatedAt = &uTime

	return &p, nil
}

func (r *StaffProfileRepository) Create(p models.StaffProfile) (string, error) {
	if p.ID == "" {
		p.ID = cuid2.Generate()
	}
	now := time.Now().UnixMilli()

	query := `
		INSERT INTO staff_profiles (id, name, degree, position, category, photo_url, nip, quote, display_order, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, p.ID, p.Name, p.Degree, p.Position, p.Category, p.PhotoUrl, p.NIP, p.Quote, p.DisplayOrder, p.IsActive, now, now)
	return p.ID, err
}

func (r *StaffProfileRepository) Update(id string, p models.StaffProfile) error {
	now := time.Now().UnixMilli()
	query := `
		UPDATE staff_profiles 
		SET name = ?, degree = ?, position = ?, category = ?, photo_url = ?, nip = ?, quote = ?, display_order = ?, is_active = ?, updated_at = ?
		WHERE id = ?
	`
	res, err := r.DB.Exec(query, p.Name, p.Degree, p.Position, p.Category, p.PhotoUrl, p.NIP, p.Quote, p.DisplayOrder, p.IsActive, now, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err == nil && affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *StaffProfileRepository) Delete(id string) error {
	res, err := r.DB.Exec("DELETE FROM staff_profiles WHERE id = ?", id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err == nil && affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
