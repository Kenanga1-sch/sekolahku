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
		SELECT id, name, COALESCE(email,''), email_verified, image, username, password_hash, role, full_name, phone, is_active, must_change_password, created_at, updated_at
		FROM users
		WHERE email = ? OR username = ? LIMIT 1
	`
	var u models.User
	var emailVerified, createdAt, updatedAt sql.NullInt64
	var name, image, username, passwordHash, fullName, phone sql.NullString
	var isActive, mustChange sql.NullInt64

	err := r.DB.QueryRow(query, email, email).Scan(
		&u.ID, &name, &u.Email, &emailVerified, &image, &username, &passwordHash, &u.Role, &fullName, &phone, &isActive, &mustChange, &createdAt, &updatedAt,
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
	u.MustChangePassword = mustChange.Int64 != 0
	u.EmailVerified = SafeTime(emailVerified)
	u.CreatedAt = SafeTime(createdAt)
	u.UpdatedAt = SafeTime(updatedAt)

	return &u, nil
}

func (r *UserRepository) GetUsers(page, limit int, search string) ([]models.User, int, error) {
	return r.GetUsersByRole(page, limit, search, nil)
}

// GetUsersByRole memfilter daftar user berdasarkan role (opsional).
// Dipakai dropdown Wali Kelas yang hanya perlu menampilkan guru.
func (r *UserRepository) GetUsersByRole(page, limit int, search string, roles []string) ([]models.User, int, error) {
	offset := (page - 1) * limit
	whereClause := "1=1"
	var args []interface{}

	if search != "" {
		whereClause += " AND (name LIKE ? OR email LIKE ? OR username LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern)
	}
	if len(roles) > 0 {
		placeholders := make([]string, len(roles))
		for i, role := range roles {
			placeholders[i] = "?"
			args = append(args, role)
		}
		whereClause += fmt.Sprintf(" AND role IN (%s)", strings.Join(placeholders, ","))
	}

	// 1. Data Query
	query := fmt.Sprintf(`
		SELECT id, name, COALESCE(email,''), role, phone, username, is_active, created_at
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

func (r *UserRepository) GetUserCountsByRole(search string, roles []string) (int, int, error) {
	whereClause := "1=1"
	var args []interface{}

	if search != "" {
		whereClause += " AND (name LIKE ? OR email LIKE ? OR username LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern)
	}
	if len(roles) > 0 {
		placeholders := make([]string, len(roles))
		for i, role := range roles {
			placeholders[i] = "?"
			args = append(args, role)
		}
		whereClause += fmt.Sprintf(" AND role IN (%s)", strings.Join(placeholders, ","))
	}

	var total, active int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*), COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0)
		FROM users
		WHERE %s
	`, whereClause)
	err := r.DB.QueryRow(countQuery, args...).Scan(&total, &active)
	if err != nil {
		return 0, 0, err
	}

	return active, total - active, nil
}

func (r *UserRepository) GetUserByID(id string) (*models.User, error) {
	query := `
		SELECT id, name, COALESCE(email,''), role, phone, username, full_name,
		       password_hash, is_active, must_change_password, student_id,
		       created_at, updated_at, image
		FROM users WHERE id = ?
	`
	var u models.User
	var name, username, phone, fullName, passwordHash, image, studentID sql.NullString
	var crAt, upAt, isActive, mustChange sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&u.ID, &name, &u.Email, &u.Role, &phone, &username, &fullName,
		&passwordHash, &isActive, &mustChange, &studentID,
		&crAt, &upAt, &image,
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
	if image.Valid {
		u.Image = &image.String
	}
	if studentID.Valid {
		u.StudentID = &studentID.String
	}
	u.IsActive = isActive.Int64 != 0
	u.MustChangePassword = mustChange.Int64 != 0
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
	mustChangeInt := 0
	if u.MustChangePassword {
		mustChangeInt = 1
	}

	query := `
		INSERT INTO users (id, name, full_name, email, username, password_hash, role, phone, is_active, must_change_password, student_id, created_at, updated_at)
		VALUES (?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, u.ID, u.Name, u.FullName, u.Email, u.Username, u.PasswordHash, u.Role, u.Phone, isActiveInt, mustChangeInt, u.StudentID, now, now)
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

	image := existing.Image
	if u.Image != nil {
		image = u.Image
	}

	isActiveInt := 0
	if existing.IsActive {
		isActiveInt = 1
	}

	now := time.Now().UnixMilli()

	query := "UPDATE users SET name=?, full_name=?, username=?, role=?, phone=?, is_active=?, updated_at=?, image=?"
	args := []interface{}{name, fullName, username, role, phone, isActiveInt, now, image}

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

// userReference menandai kolom yang menyimpan rujukan ke users.id.
// Selama PRAGMA foreign_keys = ON, masih adanya baris di tabel-tabel ini
// membuat "DELETE FROM users" gagal dengan FOREIGN KEY constraint failed.
type userReference struct {
	Table  string
	Column string
	Label  string
}

var userReferences = []userReference{
	{"audit_logs", "user_id", "catatan audit"},
	{"notifications", "user_id", "notifikasi"},
	{"admin_notifications", "user_id", "notifikasi admin"},
	{"disposisi", "from_user_id", "disposisi surat (pengirim)"},
	{"disposisi", "to_user_id", "disposisi surat (penerima)"},
	{"school_documents", "created_by", "dokumen sekolah"},
	{"employee_details", "user_id", "data GTK"},
	{"surat_keluar", "created_by", "surat keluar"},
	{"tabungan_brankas_transaksi", "user_id", "transaksi brankas"},
	{"tabungan_setoran", "guru_id", "setoran tabungan (guru)"},
	{"tabungan_setoran", "bendahara_id", "setoran tabungan (bendahara)"},
	{"tabungan_transaksi", "user_id", "transaksi tabungan"},
	{"announcements", "author_id", "pengumuman"},
	{"finance_transactions", "created_by", "transaksi keuangan"},
}

// CountUserReferences memetakan label rujukan yang masih punya data untuk
// seorang pengguna. Hasil kosong berarti akun aman dihapus permanen.
// library_members sengaja tidak dihitung: foreign key-nya ON DELETE CASCADE.
func (r *UserRepository) CountUserReferences(id string) (map[string]int, error) {
	found := make(map[string]int)
	for _, ref := range userReferences {
		var n int
		// Nama tabel/kolom diambil dari konstanta di atas, bukan dari input pengguna.
		err := r.DB.QueryRow("SELECT COUNT(*) FROM "+ref.Table+" WHERE "+ref.Column+" = ?", id).Scan(&n)
		if err != nil {
			// Tabel/kolom tidak ada di versi skema ini — lewati.
			continue
		}
		if n > 0 {
			found[ref.Label] = n
		}
	}
	return found, nil
}

// CountActiveParentLinks menghitung tautan orang tua aktif milik user.
// Dipakai untuk menolak perubahan role menjadi non-orangtua selama akun
// masih tertaut ke siswa (portal ortu dijaga RoleMiddleware orangtua).
func (r *UserRepository) CountActiveParentLinks(userID string) (int, error) {
	var n int
	err := r.DB.QueryRow(
		`SELECT COUNT(*) FROM parent_students WHERE user_id = ? AND is_active = 1`,
		userID,
	).Scan(&n)
	if err != nil {
		// Skema lama/tanpa tabel parent_students: anggap tidak tertaut.
		if strings.Contains(strings.ToLower(err.Error()), "no such table") {
			return 0, nil
		}
		return 0, err
	}
	return n, nil
}

// SetUserActive menyalakan atau mematikan akun tanpa menghapus datanya.
// Dipakai jalur soft delete karena UpdateUser sengaja mempertahankan
// nilai is_active lama.
func (r *UserRepository) SetUserActive(id string, active bool) error {
	isActiveInt := 0
	if active {
		isActiveInt = 1
	}
	now := time.Now().UnixMilli()
	res, err := r.DB.Exec("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?", isActiveInt, now, id)
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
	res, err := r.DB.Exec("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?", newHash, now, id)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err == nil && rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return err
}

// LinkEmployeeToUser links an employee_detail record to a users record
// dan menyalin nama+gelar GTK ke users.name/full_name (format "Nama, Gelar")
// agar konsumen berbasis users (laporan presensi, eoffice, tabungan, dst.)
// ikut menampilkan gelar.
func (r *UserRepository) LinkEmployeeToUser(employeeID string, userID string) error {
	_, err := r.DB.Exec(`
		UPDATE users SET
		  name = (SELECT COALESCE(ed.name, '') ||
		                 CASE WHEN COALESCE(ed.degree, '') <> '' THEN ', ' || ed.degree ELSE '' END
		          FROM employee_details ed WHERE ed.id = ?),
		  full_name = (SELECT COALESCE(ed.name, '') ||
		                 CASE WHEN COALESCE(ed.degree, '') <> '' THEN ', ' || ed.degree ELSE '' END
		          FROM employee_details ed WHERE ed.id = ?)
		WHERE id = ?
	`, employeeID, employeeID, userID)
	if err != nil {
		return err
	}
	_, err = r.DB.Exec("UPDATE employee_details SET user_id = ? WHERE id = ?", userID, employeeID)
	return err
}
