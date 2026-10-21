package repository

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"time"

	"github.com/nrednav/cuid2"
)

// PasswordResetRepository mengelola token reset password sekali pakai.
// Yang disimpan hanya hash SHA-256; token mentah tidak pernah masuk DB.
type PasswordResetRepository struct {
	DB *sql.DB
}

func NewPasswordResetRepository(db *sql.DB) *PasswordResetRepository {
	return &PasswordResetRepository{DB: db}
}

// HashResetToken mengubah token mentah menjadi hash hex SHA-256.
func HashResetToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Create menyimpan token baru untuk user. Token aktif lama otomatis
// dibatalkan agar hanya tautan terakhir yang berlaku.
func (r *PasswordResetRepository) Create(userID, tokenHash string, ttl time.Duration) error {
	now := time.Now()
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(
		`UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL`,
		now.UnixMilli(), userID,
	); err != nil {
		return err
	}
	// Bersihkan token kedaluwarsa yang sudah lebih dari sehari.
	if _, err := tx.Exec(
		`DELETE FROM password_reset_tokens WHERE expires_at < ?`,
		now.Add(-24*time.Hour).UnixMilli(),
	); err != nil {
		return err
	}
	if _, err := tx.Exec(
		`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		cuid2.Generate(), userID, tokenHash, now.Add(ttl).UnixMilli(), now.UnixMilli(),
	); err != nil {
		return err
	}
	return tx.Commit()
}

// ConsumeForPasswordReset menandai token terpakai dan mengganti password
// dalam satu transaksi. Mengembalikan userID dan status berhasil.
func (r *PasswordResetRepository) ConsumeForPasswordReset(tokenHash, passwordHash string) (string, bool, error) {
	now := time.Now().UnixMilli()
	tx, err := r.DB.Begin()
	if err != nil {
		return "", false, err
	}
	defer func() { _ = tx.Rollback() }()

	var tokenID, userID string
	err = tx.QueryRow(
		`SELECT id, user_id FROM password_reset_tokens
		 WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
		tokenHash, now,
	).Scan(&tokenID, &userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", false, nil
		}
		return "", false, err
	}

	if _, err := tx.Exec(
		`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`,
		passwordHash, now, userID,
	); err != nil {
		return "", false, err
	}
	if _, err := tx.Exec(
		`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`,
		now, tokenID,
	); err != nil {
		return "", false, err
	}
	if err := tx.Commit(); err != nil {
		return "", false, err
	}
	return userID, true, nil
}
