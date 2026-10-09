package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

type PrintSettingsRepository struct {
	db *sql.DB
}

func NewPrintSettingsRepository(db *sql.DB) *PrintSettingsRepository {
	return &PrintSettingsRepository{db: db}
}

// Get mengembalikan pengaturan modul, atau default bila belum pernah disimpan.
func (r *PrintSettingsRepository) Get(module string) (*models.PrintSettings, error) {
	var s models.PrintSettings
	var repeat int
	err := r.db.QueryRow(`
		SELECT module, margin_top_mm, margin_bottom_mm, margin_left_mm, margin_right_mm,
		       repeat_header, keep_rows, updated_at
		FROM print_settings WHERE module = ?`, module).Scan(
		&s.Module, &s.MarginTopMm, &s.MarginBottomMm, &s.MarginLeftMm, &s.MarginRightMm,
		&repeat, &s.KeepRows, &s.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		d := models.DefaultPrintSettings(module)
		return &d, nil
	}
	if err != nil {
		return nil, err
	}
	s.RepeatHeader = repeat == 1
	return &s, nil
}

// Save menyimpan (upsert) pengaturan satu modul.
func (r *PrintSettingsRepository) Save(s *models.PrintSettings) error {
	repeat := 0
	if s.RepeatHeader {
		repeat = 1
	}
	_, err := r.db.Exec(`
		INSERT INTO print_settings (module, margin_top_mm, margin_bottom_mm, margin_left_mm, margin_right_mm, repeat_header, keep_rows, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(module) DO UPDATE SET
			margin_top_mm = excluded.margin_top_mm,
			margin_bottom_mm = excluded.margin_bottom_mm,
			margin_left_mm = excluded.margin_left_mm,
			margin_right_mm = excluded.margin_right_mm,
			repeat_header = excluded.repeat_header,
			keep_rows = excluded.keep_rows,
			updated_at = excluded.updated_at`,
		s.Module, s.MarginTopMm, s.MarginBottomMm, s.MarginLeftMm, s.MarginRightMm, repeat, s.KeepRows, time.Now().Unix(),
	)
	return err
}
