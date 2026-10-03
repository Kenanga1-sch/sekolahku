package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

type ThemePresetRepository struct {
	db *sql.DB
}

func NewThemePresetRepository(db *sql.DB) *ThemePresetRepository {
	return &ThemePresetRepository{db: db}
}

func (r *ThemePresetRepository) GetAll() ([]models.SavedTheme, error) {
	rows, err := r.db.Query(`
		SELECT id, name, description, brand_theme, is_default, created_at, updated_at
		FROM saved_themes
		ORDER BY is_default DESC, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.SavedTheme
	for rows.Next() {
		var t models.SavedTheme
		var isDef int
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.BrandTheme, &isDef, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.IsDefault = isDef == 1
		list = append(list, t)
	}
	return list, nil
}

func (r *ThemePresetRepository) GetByID(id string) (*models.SavedTheme, error) {
	var t models.SavedTheme
	var isDef int
	err := r.db.QueryRow(`
		SELECT id, name, description, brand_theme, is_default, created_at, updated_at
		FROM saved_themes WHERE id = ?
	`, id).Scan(&t.ID, &t.Name, &t.Description, &t.BrandTheme, &isDef, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	t.IsDefault = isDef == 1
	return &t, nil
}

func (r *ThemePresetRepository) Create(req models.SavedThemeRequest) (*models.SavedTheme, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("nama preset wajib diisi")
	}
	if strings.TrimSpace(req.BrandTheme) == "" {
		return nil, fmt.Errorf("data brand_theme wajib diisi")
	}

	now := time.Now().UnixMilli()
	id := fmt.Sprintf("preset-%d", now)
	_, err := r.db.Exec(`
		INSERT INTO saved_themes (id, name, description, brand_theme, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, ?, ?)
	`, id, name, strings.TrimSpace(req.Description), strings.TrimSpace(req.BrandTheme), now, now)
	if err != nil {
		return nil, err
	}
	return r.GetByID(id)
}

func (r *ThemePresetRepository) Update(id string, req models.SavedThemeRequest) (*models.SavedTheme, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("nama preset wajib diisi")
	}
	now := time.Now().UnixMilli()
	res, err := r.db.Exec(`
		UPDATE saved_themes SET name = ?, description = ?, brand_theme = ?, updated_at = ?
		WHERE id = ?
	`, name, strings.TrimSpace(req.Description), strings.TrimSpace(req.BrandTheme), now, id)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, fmt.Errorf("preset tidak ditemukan")
	}
	return r.GetByID(id)
}

func (r *ThemePresetRepository) Delete(id string) error {
	// Preset seed ber-ID "preset-teal-classic" dsb tetap boleh dihapus oleh admin.
	res, err := r.db.Exec(`DELETE FROM saved_themes WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("preset tidak ditemukan")
	}
	return nil
}
