package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
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
		WHERE email = ? OR username = ? LIMIT 1
	`
	var u models.User
	var emailVerified, createdAt, updatedAt sql.NullInt64
	var name, image, username, passwordHash, fullName, phone sql.NullString
	var isActive sql.NullInt64 // sqlite boolean is stored as integer

	err := r.DB.QueryRow(query, email, email).Scan(
		&u.ID, &name, &u.Email, &emailVerified, &image, &username, &passwordHash, &u.Role, &fullName, &phone, &isActive, &createdAt, &updatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, err
	}

	if name.Valid {
		u.Name = &name.String
	}
	if image.Valid {
		u.Image = &image.String
	}
	if username.Valid {
		u.Username = &username.String
	}
	if passwordHash.Valid {
		u.PasswordHash = &passwordHash.String
	}
	if fullName.Valid {
		u.FullName = &fullName.String
	}
	if phone.Valid {
		u.Phone = &phone.String
	}
	u.IsActive = isActive.Int64 != 0
	u.EmailVerified = SafeTime(emailVerified)
	u.CreatedAt = SafeTime(createdAt)
	u.UpdatedAt = SafeTime(updatedAt)

	return &u, nil
}

func (r *UserRepository) GetUsers(page, limit int, search string) ([]models.User, int, error) {
	offset := (page - 1) * limit
	whereClause := "1=1"
	var args []interface{}

	if search != "" {
		whereClause += " AND (name LIKE ? OR email LIKE ? OR username LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern)
	}

	// 1. Data Query
	query := fmt.Sprintf(`
		SELECT id, name, email, role, phone, username, is_active, created_at
		FROM users
		WHERE %s
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	dataArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		var name, username, phone sql.NullString
		var crAt, isActive sql.NullInt64

		err := rows.Scan(&u.ID, &name, &u.Email, &u.Role, &phone, &username, &isActive, &crAt)
		if err != nil {
			return nil, 0, err
		}

		if name.Valid {
			u.Name = &name.String
		}
		if username.Valid {
			u.Username = &username.String
		}
		if phone.Valid {
			u.Phone = &phone.String
		}
		u.IsActive = isActive.Int64 != 0
		u.CreatedAt = SafeTime(crAt)

		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	// 2. Count Query
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM users WHERE %s", whereClause)
	err = r.DB.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	if users == nil {
		users = []models.User{}
	}

	return users, total, nil
}

func (r *UserRepository) GetUserByID(id string) (*models.User, error) {
	query := `
		SELECT id, name, email, role, phone, username, full_name, password_hash, is_active, created_at, updated_at
		FROM users WHERE id = ?
	`
	var u models.User
	var name, username, phone, fullName, passwordHash sql.NullString
	var crAt, upAt, isActive sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&u.ID, &name, &u.Email, &u.Role, &phone, &username, &fullName, &passwordHash, &isActive, &crAt, &upAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if name.Valid {
		u.Name = &name.String
	}
	if username.Valid {
		u.Username = &username.String
	}
	if phone.Valid {
		u.Phone = &phone.String
	}
	if fullName.Valid {
		u.FullName = &fullName.String
	}
	if passwordHash.Valid {
		u.PasswordHash = &passwordHash.String
	}
	u.IsActive = isActive.Int64 != 0
	u.CreatedAt = SafeTime(crAt)
	u.UpdatedAt = SafeTime(upAt)

	return &u, nil
}

func (r *UserRepository) CreateUser(u models.User) (string, error) {
	if u.ID == "" {
		u.ID = cuid2.Generate()
	}
	now := time.Now().UnixMilli()

	isActiveInt := 0
	if u.IsActive {
		isActiveInt = 1
	}

	query := `
		INSERT INTO users (id, name, full_name, email, username, password_hash, role, phone, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, u.ID, u.Name, u.FullName, u.Email, u.Username, u.PasswordHash, u.Role, u.Phone, isActiveInt, now, now)
	if err != nil {
		return "", err
	}
	return u.ID, nil
}

func (r *UserRepository) UpdateUser(id string, u models.User) error {
	existing, err := r.GetUserByID(id)
	if err != nil {
		return err
	}
	if existing == nil {
		return sql.ErrNoRows
	}

	name := existing.Name
	if u.Name != nil {
		name = u.Name
	}

	fullName := existing.FullName
	if u.FullName != nil {
		fullName = u.FullName
	}
	if fullName == nil && name != nil {
		fullName = name
	}

	username := existing.Username
	if u.Username != nil {
		username = u.Username
	}

	role := existing.Role
	if strings.TrimSpace(u.Role) != "" {
		role = strings.TrimSpace(u.Role)
	}

	phone := existing.Phone
	if u.Phone != nil {
		phone = u.Phone
	}

	isActiveInt := 0
	if existing.IsActive {
		isActiveInt = 1
	}

	now := time.Now().UnixMilli()

	query := "UPDATE users SET name=?, full_name=?, username=?, role=?, phone=?, is_active=?, updated_at=?"
	args := []interface{}{name, fullName, username, role, phone, isActiveInt, now}

	if u.PasswordHash != nil && *u.PasswordHash != "" {
		query += ", password_hash=?"
		args = append(args, u.PasswordHash)
	}

	query += " WHERE id=?"
	args = append(args, id)

	res, err := r.DB.Exec(query, args...)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err == nil && rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return err
}

func (r *UserRepository) DeleteUser(id string) error {
	res, err := r.DB.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err == nil && rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return err
}

func (r *UserRepository) UpdatePassword(id string, newHash string) error {
	now := time.Now().UnixMilli()
	res, err := r.DB.Exec("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", newHash, now, id)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err == nil && rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return err
}
