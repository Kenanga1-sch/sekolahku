package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// LibraryStickerPresetRepository menyimpan tata letak stiker QR milik operator.
// Preset bersifat global (dibagi semua akun admin), bukan per-browser.
type LibraryStickerPresetRepository struct {
	DB *sql.DB
}

func NewLibraryStickerPresetRepository(db *sql.DB) *LibraryStickerPresetRepository {
	return &LibraryStickerPresetRepository{DB: db}
}

// ensureStickerPresetTable menjadi jaring pengaman bila migrasi 000058 belum
// dijalankan (mis. database lama yang sudah terisi). Sejalan dengan pola
// ensureQRBatchTable di library_asset_repo.go.
func (r *LibraryStickerPresetRepository) ensureStickerPresetTable() error {
	_, err := r.DB.Exec(`
		CREATE TABLE IF NOT EXISTS library_sticker_presets (
			id           TEXT PRIMARY KEY,
			name         TEXT NOT NULL,
			paper_width  REAL NOT NULL,
			paper_height REAL NOT NULL,
			label_width  REAL NOT NULL,
			label_height REAL NOT NULL,
			gap_x        REAL NOT NULL DEFAULT 0,
			gap_y        REAL NOT NULL DEFAULT 0,
			font_size    REAL NOT NULL DEFAULT 10,
			created_by   TEXT NULL,
			created_at   INTEGER,
			updated_at   INTEGER
		)
	`)
	return err
}

// ListStickerPresets mengembalikan semua preset, terbaru lebih dulu.
func (r *LibraryStickerPresetRepository) ListStickerPresets() ([]models.StickerPreset, error) {
	if err := r.ensureStickerPresetTable(); err != nil {
		return nil, err
	}

	rows, err := r.DB.Query(`
		SELECT p.id, p.name, p.paper_width, p.paper_height,
		       p.label_width, p.label_height, p.gap_x, p.gap_y, p.font_size,
		       COALESCE(p.created_by, ''), COALESCE(u.name, '')
		FROM library_sticker_presets p
		LEFT JOIN users u ON u.id = p.created_by
		ORDER BY p.created_at DESC, p.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	presets := make([]models.StickerPreset, 0)
	for rows.Next() {
		var p models.StickerPreset
		if err := rows.Scan(
			&p.ID, &p.Name, &p.PaperWidth, &p.PaperHeight,
			&p.LabelWidth, &p.LabelHeight, &p.GapX, &p.GapY, &p.FontSize,
			&p.CreatedBy, &p.CreatedByName,
		); err != nil {
			return nil, err
		}
		presets = append(presets, p)
	}
	return presets, rows.Err()
}

// validateStickerPreset menegakkan batas ukuran yang wajar. Dimensi disimpan
// dalam milimeter; nilai <=0 akan membuat perhitungan kisi rusak.
func validateStickerPreset(p *models.StickerPreset) error {
	p.Name = strings.TrimSpace(p.Name)
	if p.Name == "" {
		return errors.New("nama preset wajib diisi")
	}
	if len([]rune(p.Name)) > 100 {
		return errors.New("nama preset maksimal 100 karakter")
	}

	dims := map[string]float64{
		"lebar kertas":  p.PaperWidth,
		"tinggi kertas": p.PaperHeight,
		"lebar label":   p.LabelWidth,
		"tinggi label":  p.LabelHeight,
	}
	for label, v := range dims {
		if v <= 0 {
			return errors.New(label + " harus lebih dari 0")
		}
		if v > 1000 {
			return errors.New(label + " tidak wajar (maksimal 1000 mm)")
		}
	}
	if p.GapX < 0 || p.GapY < 0 {
		return errors.New("jarak antar label tidak boleh negatif")
	}
	if p.GapX > 100 || p.GapY > 100 {
		return errors.New("jarak antar label tidak wajar (maksimal 100 mm)")
	}
	if p.LabelWidth > p.PaperWidth || p.LabelHeight > p.PaperHeight {
		return errors.New("ukuran label tidak boleh melebihi ukuran kertas")
	}
	if p.FontSize < 4 || p.FontSize > 20 {
		return errors.New("ukuran font harus antara 4 dan 20 pt")
	}
	return nil
}

// CreateStickerPreset menyimpan preset baru milik userID.
func (r *LibraryStickerPresetRepository) CreateStickerPreset(p models.StickerPreset, userID string) (*models.StickerPreset, error) {
	if err := r.ensureStickerPresetTable(); err != nil {
		return nil, err
	}
	if err := validateStickerPreset(&p); err != nil {
		return nil, err
	}

	p.ID = cuid2.Generate()
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO library_sticker_presets (
			id, name, paper_width, paper_height, label_width, label_height,
			gap_x, gap_y, font_size, created_by, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, p.ID, p.Name, p.PaperWidth, p.PaperHeight, p.LabelWidth, p.LabelHeight,
		p.GapX, p.GapY, p.FontSize, userID, now, now)
	if err != nil {
		return nil, err
	}
	p.CreatedBy = userID
	return &p, nil
}

// UpdateStickerPreset mengubah preset yang sudah ada. Pembuat tidak diubah.
func (r *LibraryStickerPresetRepository) UpdateStickerPreset(id string, p models.StickerPreset) (*models.StickerPreset, error) {
	if err := r.ensureStickerPresetTable(); err != nil {
		return nil, err
	}
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("id preset wajib diisi")
	}
	if err := validateStickerPreset(&p); err != nil {
		return nil, err
	}

	now := UnixMilli()
	res, err := r.DB.Exec(`
		UPDATE library_sticker_presets
		SET name = ?, paper_width = ?, paper_height = ?, label_width = ?,
		    label_height = ?, gap_x = ?, gap_y = ?, font_size = ?, updated_at = ?
		WHERE id = ?
	`, p.Name, p.PaperWidth, p.PaperHeight, p.LabelWidth, p.LabelHeight,
		p.GapX, p.GapY, p.FontSize, now, id)
	if err != nil {
		return nil, err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return nil, errors.New("preset tidak ditemukan")
	}

	p.ID = id
	return &p, nil
}

// DeleteStickerPreset menghapus preset berdasarkan id.
func (r *LibraryStickerPresetRepository) DeleteStickerPreset(id string) error {
	if err := r.ensureStickerPresetTable(); err != nil {
		return err
	}
	if strings.TrimSpace(id) == "" {
		return errors.New("id preset wajib diisi")
	}
	res, err := r.DB.Exec(`DELETE FROM library_sticker_presets WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return errors.New("preset tidak ditemukan")
	}
	return nil
}
