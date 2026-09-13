package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type PushRepository struct {
	DB *sql.DB
}

func NewPushRepository(db *sql.DB) *PushRepository {
	return &PushRepository{DB: db}
}

// Upsert menyimpan/langganan perangkat. Endpoint unik: perangkat yang sama
// mendaftar ulang cukup memperbarui baris (mis. setelah user ganti akun,
// subscription tetap satu).
func (r *PushRepository) Upsert(userID string, req models.PushSubscribeRequest) error {
	now := time.Now().UnixMilli()
	var existingID string
	err := r.DB.QueryRow(`SELECT id FROM push_subscriptions WHERE endpoint = ?`, req.Endpoint).Scan(&existingID)
	if err == nil {
		_, err = r.DB.Exec(`
			UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, updated_at = ?
			WHERE id = ?
		`, userID, req.P256dh, req.Auth, req.UserAgent, now, existingID)
		return err
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	_, err = r.DB.Exec(`
		INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, cuid2.Generate(), userID, req.Endpoint, req.P256dh, req.Auth, req.UserAgent, now, now)
	return err
}

// DeleteByEndpoint menghapus subscription milik user tertentu (anti
// penyalahgunaan: user tak bisa menghapus perangkat orang lain).
func (r *PushRepository) DeleteByEndpoint(userID, endpoint string) error {
	_, err := r.DB.Exec(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`, userID, endpoint)
	return err
}

// DeleteByID dipakai saat push service menolak endpoint (410/404 — mati).
func (r *PushRepository) DeleteByID(id string) error {
	_, err := r.DB.Exec(`DELETE FROM push_subscriptions WHERE id = ?`, id)
	return err
}

// ListByUser semua perangkat aktif milik satu user.
func (r *PushRepository) ListByUser(userID string) ([]models.PushSubscription, error) {
	rows, err := r.DB.Query(`
		SELECT id, user_id, endpoint, p256dh, auth, COALESCE(user_agent,''), created_at, updated_at, last_used_at
		FROM push_subscriptions WHERE user_id = ? ORDER BY created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.PushSubscription, 0)
	for rows.Next() {
		var s models.PushSubscription
		var ca, ua int64
		var last sql.NullInt64
		if err := rows.Scan(&s.ID, &s.UserID, &s.Endpoint, &s.P256dh, &s.Auth, &s.UserAgent, &ca, &ua, &last); err != nil {
			return nil, err
		}
		s.CreatedAt = time.UnixMilli(ca)
		s.UpdatedAt = time.UnixMilli(ua)
		if last.Valid {
			t := time.UnixMilli(last.Int64)
			s.LastUsedAt = &t
		}
		list = append(list, s)
	}
	return list, nil
}

// Touch menandai subscription baru saja sukses dipakai.
func (r *PushRepository) Touch(id string) error {
	_, err := r.DB.Exec(`UPDATE push_subscriptions SET last_used_at = ? WHERE id = ?`, time.Now().UnixMilli(), id)
	return err
}

// CountByUser jumlah perangkat; berguna untuk UI "aktif di N perangkat".
func (r *PushRepository) CountByUser(userID string) (int, error) {
	var n int
	err := r.DB.QueryRow(`SELECT COUNT(*) FROM push_subscriptions WHERE user_id = ?`, userID).Scan(&n)
	return n, err
}
