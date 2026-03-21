package repository

import (
	"database/sql"
	"errors"

	"github.com/sekolahku/go-backend/internal/models"
)

type UserRepository struct {
	DB *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{DB: db}
}

func (r *UserRepository) GetUserByEmail(email string) (*models.User, error) {
	query := `
		SELECT id, name, email, email_verified, image, username, password_hash, role, full_name, phone, is_active, created_at, updated_at
		FROM users
		WHERE email = ? LIMIT 1
	`
	var u models.User
	var emailVerified, createdAt, updatedAt sql.NullTime
	var name, image, username, passwordHash, fullName, phone sql.NullString
	var isActive sql.NullInt64 // sqlite boolean is stored as integer

	err := r.DB.QueryRow(query, email).Scan(
		&u.ID, &name, &u.Email, &emailVerified, &image, &username, &passwordHash, &u.Role, &fullName, &phone, &isActive, &createdAt, &updatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, err
	}

	// Map nullables
	if name.Valid { u.Name = &name.String }
	if image.Valid { u.Image = &image.String }
	if username.Valid { u.Username = &username.String }
	if passwordHash.Valid { u.PasswordHash = &passwordHash.String }
	if fullName.Valid { u.FullName = &fullName.String }
	if phone.Valid { u.Phone = &phone.String }
	
	if isActive.Valid {
		u.IsActive = isActive.Int64 != 0
	} else {
		u.IsActive = true // Default fallback
	}

	if emailVerified.Valid { u.EmailVerified = &emailVerified.Time }
	if createdAt.Valid { u.CreatedAt = &createdAt.Time }
	if updatedAt.Valid { u.UpdatedAt = &updatedAt.Time }

	return &u, nil
}
