package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type GalleryRepository struct {
	DB *sql.DB
}

func NewGalleryRepository(db *sql.DB) *GalleryRepository {
	return &GalleryRepository{DB: db}
}

func (r *GalleryRepository) GetGallery(category string) ([]models.GalleryItem, error) {
	sqlQuery := "SELECT id, title, description, category, image_url, public_id, created_at, updated_at FROM gallery WHERE 1=1"
	args := []interface{}{}

	if category != "" && category != "all" {
		sqlQuery += " AND category = ?"
		args = append(args, category)
	}

	sqlQuery += " ORDER BY created_at DESC"

	rows, err := r.DB.Query(sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.GalleryItem
	for rows.Next() {
		var item models.GalleryItem
		var title, category, desc, pubID sql.NullString
		var crAt, upAt sql.NullInt64

		err := rows.Scan(&item.ID, &title, &desc, &category, &item.ImageUrl, &pubID, &crAt, &upAt)
		if err != nil {
			return nil, err
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
		cTime := ToTime(crAt)
		item.CreatedAt = &cTime
		uTime := ToTime(upAt)
		item.UpdatedAt = &uTime
		items = append(items, item)
	}
	if items == nil {
		items = []models.GalleryItem{}
	}
	return items, nil
}

func (r *GalleryRepository) GetStats() (*models.GalleryStats, error) {
	var total int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM gallery").Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.DB.Query("SELECT COALESCE(category, 'lainnya'), COUNT(*) FROM gallery GROUP BY COALESCE(category, 'lainnya')")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make(map[string]int)
	for rows.Next() {
		var cat string
		var count int
		if err := rows.Scan(&cat, &count); err == nil {
			categories[cat] = count
		}
	}

	// For storage, we can't easily calculate file size from DB alone
	// but we could store it or just return a dummy/placeholder for now
	// as "used storage" usually involves filesystem analysis
	return &models.GalleryStats{
		Total:      total,
		Categories: categories,
		Storage: models.GalleryStorageInfo{
			Used: 0.0,
			Unit: "MB",
		},
	}, nil
}

func (r *GalleryRepository) GetByID(id string) (*models.GalleryItem, error) {
	var item models.GalleryItem
	var title, category, desc, pubID sql.NullString
	var crAt, upAt sql.NullInt64

	err := r.DB.QueryRow("SELECT id, title, description, category, image_url, public_id, created_at, updated_at FROM gallery WHERE id = ?", id).
		Scan(&item.ID, &title, &desc, &category, &item.ImageUrl, &pubID, &crAt, &upAt)
	if err != nil {
		return nil, err
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
	cTime := ToTime(crAt)
	item.CreatedAt = &cTime
	uTime := ToTime(upAt)
	item.UpdatedAt = &uTime

	return &item, nil
}

func (r *GalleryRepository) Create(item models.GalleryItem) (string, error) {
	if item.ID == "" {
		item.ID = cuid2.Generate()
	}
	now := time.Now().UnixMilli()

	_, err := r.DB.Exec(`
		INSERT INTO gallery (id, title, description, category, image_url, public_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, item.ID, item.Title, item.Description, item.Category, item.ImageUrl, item.PublicID, now, now)
	return item.ID, err
}

func (r *GalleryRepository) Update(id string, title, category string) error {
	now := time.Now().UnixMilli()
	res, err := r.DB.Exec("UPDATE gallery SET title = ?, category = ?, updated_at = ? WHERE id = ?", title, category, now, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err == nil && affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *GalleryRepository) Delete(id string) error {
	res, err := r.DB.Exec("DELETE FROM gallery WHERE id = ?", id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err == nil && affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *GalleryRepository) BulkDelete(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf("DELETE FROM gallery WHERE id IN (%s)", strings.Join(placeholders, ","))
	_, err := r.DB.Exec(query, args...)
	return err
}

func (r *GalleryRepository) GetImagePathsByIDs(ids []string) ([]string, error) {
	if len(ids) == 0 {
		return []string{}, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf("SELECT image_url FROM gallery WHERE id IN (%s)", strings.Join(placeholders, ","))
	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err == nil {
			paths = append(paths, path)
		}
	}
	return paths, nil
}
