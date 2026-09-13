package repository

import (
	"database/sql"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
)

// Kategori preferensi notifikasi ortu.
const (
	NotifCategoryAbsensi   = "absensi"
	NotifCategoryTabungan  = "tabungan"
	NotifCategoryPengumuman = "pengumuman"
	NotifCategoryPR        = "pr"
	NotifCategoryUmum      = "umum"
)

type PreferenceRepository struct {
	DB *sql.DB
}

func NewPreferenceRepository(db *sql.DB) *PreferenceRepository {
	return &PreferenceRepository{DB: db}
}

// SetPreference menyimpan preferensi kategori untuk user (upsert).
func (r *PreferenceRepository) SetPreference(userID, category string, enabled bool) error {
	cat := strings.ToLower(strings.TrimSpace(category))
	enabledInt := 0
	if enabled {
		enabledInt = 1
	}
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO notification_preferences (id, user_id, category, enabled, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id, category) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at
	`, cuid2.Generate(), userID, cat, enabledInt, now)
	return err
}

// GetPreferences semua preferensi user; kategori tanpa baris = aktif.
func (r *PreferenceRepository) GetPreferences(userID string) (map[string]bool, error) {
	rows, err := r.DB.Query(`SELECT category, enabled FROM notification_preferences WHERE user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	prefs := map[string]bool{}
	for rows.Next() {
		var cat string
		var enabled int
		if err := rows.Scan(&cat, &enabled); err != nil {
			return nil, err
		}
		prefs[cat] = enabled == 1
	}
	return prefs, nil
}

// FilterEnabled menyaring daftar user: yang menonaktifkan kategori dibuang.
// (Tidak ada baris = aktif.)
func (r *PreferenceRepository) FilterEnabled(userIDs []string, category string) []string {
	if len(userIDs) == 0 {
		return nil
	}
	out := make([]string, 0, len(userIDs))
	for _, uid := range userIDs {
		var enabled sql.NullInt64
		err := r.DB.QueryRow(
			`SELECT enabled FROM notification_preferences WHERE user_id = ? AND category = ?`,
			uid, strings.ToLower(strings.TrimSpace(category)),
		).Scan(&enabled)
		if err == sql.ErrNoRows {
			out = append(out, uid) // default aktif
			continue
		}
		if err != nil {
			continue
		}
		if enabled.Int64 != 0 {
			out = append(out, uid)
		}
	}
	return out
}

