package repository

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// ProviderGoogle nama penyedia identitas yang didukung.
const ProviderGoogle = "google"

type UserIdentityRepository struct {
	DB *sql.DB
}

func NewUserIdentityRepository(db *sql.DB) *UserIdentityRepository {
	return &UserIdentityRepository{DB: db}
}

// GetByProvider mencari identitas berdasarkan provider + ID unik dari provider.
// Mengembalikan (nil, nil) bila belum ada.
func (r *UserIdentityRepository) GetByProvider(provider, providerUserID string) (*models.UserIdentity, error) {
	var ident models.UserIdentity
	var email sql.NullString
	var verified sql.NullInt64
	var createdAt, updatedAt sql.NullInt64

	err := r.DB.QueryRow(`
		SELECT id, user_id, provider, provider_user_id, email, email_verified, created_at, updated_at
		FROM user_identities
		WHERE provider = ? AND provider_user_id = ?
		LIMIT 1
	`, provider, providerUserID).Scan(
		&ident.ID, &ident.UserID, &ident.Provider, &ident.ProviderUserID,
		&email, &verified, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if email.Valid {
		ident.Email = &email.String
	}
	ident.EmailVerified = verified.Int64 != 0
	ident.CreatedAt = SafeTime(createdAt)
	ident.UpdatedAt = SafeTime(updatedAt)
	return &ident, nil
}

// GetByUserProvider mencari identitas milik satu user pada provider tertentu.
func (r *UserIdentityRepository) GetByUserProvider(userID, provider string) (*models.UserIdentity, error) {
	var ident models.UserIdentity
	var email sql.NullString
	var verified sql.NullInt64
	var createdAt, updatedAt sql.NullInt64

	err := r.DB.QueryRow(`
		SELECT id, user_id, provider, provider_user_id, email, email_verified, created_at, updated_at
		FROM user_identities
		WHERE user_id = ? AND provider = ?
		LIMIT 1
	`, userID, provider).Scan(
		&ident.ID, &ident.UserID, &ident.Provider, &ident.ProviderUserID,
		&email, &verified, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if email.Valid {
		ident.Email = &email.String
	}
	ident.EmailVerified = verified.Int64 != 0
	ident.CreatedAt = SafeTime(createdAt)
	ident.UpdatedAt = SafeTime(updatedAt)
	return &ident, nil
}

// CreateIdentity menautkan identitas provider ke akun lokal.
// Idempoten: (provider, provider_user_id) unik, sehingga pemanggilan ulang
// memperbarui email/verified dan mengembalikan user_id yang sudah ada.
func (r *UserIdentityRepository) CreateIdentity(ident models.UserIdentity) (string, error) {
	if ident.ID == "" {
		ident.ID = cuid2.Generate()
	}
	now := time.Now().UnixMilli()

	verified := 0
	if ident.EmailVerified {
		verified = 1
	}

	email := ""
	if ident.Email != nil {
		email = strings.TrimSpace(*ident.Email)
	}

	_, err := r.DB.Exec(`
		INSERT INTO user_identities
			(id, user_id, provider, provider_user_id, email, email_verified, created_at, updated_at)
		VALUES (?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?)
		ON CONFLICT(provider, provider_user_id) DO UPDATE SET
			email = excluded.email,
			email_verified = excluded.email_verified,
			updated_at = excluded.updated_at
	`, ident.ID, ident.UserID, ident.Provider, ident.ProviderUserID, email, verified, now, now)
	if err != nil {
		return "", err
	}
	return ident.ID, nil
}

// DeleteByUserProvider melepas tautan identitas (mis. saat admin mencabut akses).
func (r *UserIdentityRepository) DeleteByUserProvider(userID, provider string) error {
	_, err := r.DB.Exec(
		`DELETE FROM user_identities WHERE user_id = ? AND provider = ?`,
		userID, provider,
	)
	return err
}
