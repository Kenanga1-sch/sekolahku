package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"path/filepath"
	"strings"

	"cloudstorage/internal/model"

	sqlite "modernc.org/sqlite"
)

const fileColumns = "id, name, parent_id, is_folder, file_id, message_id, mime_type, size, encrypted, updated_at, deleted_at, share_token, share_expires_at"

type querier interface {
	Exec(query string, args ...any) (sql.Result, error)
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
}

type Repository struct {
	db    querier
	sqlDB *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db, sqlDB: db}
}

// WithTx menjalankan fn dalam satu transaksi. Jika fn mengembalikan error,
// transaksi di-rollback.
func (r *Repository) WithTx(fn func(repo *Repository) error) error {
	tx, err := r.sqlDB.Begin()
	if err != nil {
		return err
	}
	txRepo := &Repository{db: tx}
	if err := fn(txRepo); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func InitDB(path string) *sql.DB {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	_, _ = db.Exec("PRAGMA journal_mode=WAL;")
	_, _ = db.Exec("PRAGMA busy_timeout=5000;")

	schema := `
	CREATE TABLE IF NOT EXISTS files (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		parent_id TEXT,
		is_folder INTEGER NOT NULL DEFAULT 0,
		file_id TEXT,
		message_id INTEGER,
		mime_type TEXT,
		size INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		deleted_at INTEGER,
		share_token TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_files_parent_id ON files(parent_id);
	CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
	CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);
	CREATE INDEX IF NOT EXISTS idx_files_share_token ON files(share_token);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT
	);
	`

	_, err = db.Exec(schema)
	if err != nil {
		log.Fatalf("failed to create tables: %v", err)
	}

	if err := migrate(db); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	return db
}

// ensureUniqueNameIndex membersihkan nama duplikat (jika ada dari versi lama)
// lalu membuat unique index (name, parent) untuk mencegah nama kembar secara
// atomik pada operasi yang konkuren.
func ensureUniqueNameIndex(db *sql.DB) error {
	rows, err := db.Query("SELECT id, name, COALESCE(parent_id,'') AS parent FROM files WHERE deleted_at IS NULL ORDER BY parent, name")
	if err != nil {
		return err
	}

	type row struct{ id, parent, name string }
	seen := make(map[string]bool)
	var dups []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.name, &r.parent); err != nil {
			rows.Close()
			return err
		}
		key := r.parent + "\x00" + r.name
		if seen[key] {
			dups = append(dups, r)
		} else {
			seen[key] = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, d := range dups {
		ext := filepath.Ext(d.name)
		stem := strings.TrimSuffix(d.name, ext)
		n := 1
		var candidate string
		for {
			candidate = fmt.Sprintf("%s (%d)%s", stem, n, ext)
			if !seen[d.parent+"\x00"+candidate] {
				break
			}
			n++
		}
		if _, err := db.Exec("UPDATE files SET name = ? WHERE id = ?", candidate, d.id); err != nil {
			return err
		}
		seen[d.parent+"\x00"+candidate] = true
	}

	_, err = db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_files_unique_name ON files(name, COALESCE(parent_id,'')) WHERE deleted_at IS NULL")
	return err
}

// IsUniqueConstraint mengembalikan true jika error berasal dari pelanggaran
// unique constraint SQLite (mis. nama duplikat).
func IsUniqueConstraint(err error) bool {
	if err == nil {
		return false
	}
	var se *sqlite.Error
	if errors.As(err, &se) {
		if se.Code() == 2067 {
			return true
		}
		if se.Code() == 19 && strings.Contains(se.Error(), "UNIQUE") {
			return true
		}
	}
	return strings.Contains(err.Error(), "UNIQUE constraint failed")
}

func migrate(db *sql.DB) error {
	rows, err := db.Query("PRAGMA table_info(files)")
	if err != nil {
		return err
	}
	defer rows.Close()

	cols := make(map[string]bool)
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			return err
		}
		cols[name] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}

	added := []struct {
		name, ddl string
	}{
		{"message_id", "INTEGER"},
		{"mime_type", "TEXT"},
		{"size", "INTEGER NOT NULL DEFAULT 0"},
		{"encrypted", "INTEGER NOT NULL DEFAULT 0"},
		{"created_at", "INTEGER NOT NULL DEFAULT 0"},
		{"updated_at", "INTEGER NOT NULL DEFAULT 0"},
		{"deleted_at", "INTEGER"},
		{"share_token", "TEXT"},
		{"share_expires_at", "INTEGER"},
	}
	for _, col := range added {
		if cols[col.name] {
			continue
		}
		if _, err := db.Exec("ALTER TABLE files ADD COLUMN " + col.name + " " + col.ddl); err != nil {
			return err
		}
	}

	if err := ensureUniqueNameIndex(db); err != nil {
		return err
	}
	return nil
}

func scanFile(row interface {
	Scan(dest ...interface{}) error
}) (*model.File, error) {
	var f model.File
	var parentIDVal, fileIDVal, shareTokenVal sql.NullString
	var messageIDVal, deletedAtVal, shareExpiresVal, encryptedVal sql.NullInt64
	if err := row.Scan(&f.ID, &f.Name, &parentIDVal, &f.IsFolder, &fileIDVal, &messageIDVal, &f.MimeType, &f.Size, &encryptedVal, &f.UpdatedAt, &deletedAtVal, &shareTokenVal, &shareExpiresVal); err != nil {
		return nil, err
	}
	if parentIDVal.Valid {
		f.ParentID = &parentIDVal.String
	}
	if fileIDVal.Valid {
		f.FileID = &fileIDVal.String
	}
	if messageIDVal.Valid {
		f.MessageID = &messageIDVal.Int64
	}
	if shareTokenVal.Valid {
		f.ShareToken = &shareTokenVal.String
	}
	if shareExpiresVal.Valid {
		f.ShareExpiresAt = &shareExpiresVal.Int64
	}
	if deletedAtVal.Valid {
		f.DeletedAt = &deletedAtVal.Int64
	}
	if encryptedVal.Valid {
		f.Encrypted = encryptedVal.Int64 != 0
	}
	return &f, nil
}

func (r *Repository) ListFiles(parentID *string) ([]model.File, error) {
	return r.listFiles(parentID, "deleted_at IS NULL")
}

func (r *Repository) ListFilesAny(parentID *string) ([]model.File, error) {
	return r.listFiles(parentID, "1=1")
}

func (r *Repository) ListAllFolders() ([]model.File, error) {
	rows, err := r.db.Query("SELECT " + fileColumns + " FROM files WHERE is_folder = 1 AND deleted_at IS NULL ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	folders := []model.File{}
	for rows.Next() {
		f, err := scanFile(rows)
		if err != nil {
			return nil, err
		}
		folders = append(folders, *f)
	}
	return folders, rows.Err()
}

func (r *Repository) listFiles(parentID *string, filter string) ([]model.File, error) {
	var rows *sql.Rows
	var err error
	if parentID == nil {
		rows, err = r.db.Query("SELECT " + fileColumns + " FROM files WHERE parent_id IS NULL AND " + filter + " ORDER BY is_folder DESC, name ASC")
	} else {
		rows, err = r.db.Query("SELECT "+fileColumns+" FROM files WHERE parent_id = ? AND "+filter+" ORDER BY is_folder DESC, name ASC", *parentID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := []model.File{}
	for rows.Next() {
		f, err := scanFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	return files, rows.Err()
}

func (r *Repository) ListFilesPage(parentID *string, limit, offset int) ([]model.File, error) {
	var rows *sql.Rows
	var err error
	if parentID == nil {
		rows, err = r.db.Query("SELECT "+fileColumns+" FROM files WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY is_folder DESC, name ASC LIMIT ? OFFSET ?", limit, offset)
	} else {
		rows, err = r.db.Query("SELECT "+fileColumns+" FROM files WHERE parent_id = ? AND deleted_at IS NULL ORDER BY is_folder DESC, name ASC LIMIT ? OFFSET ?", *parentID, limit, offset)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := []model.File{}
	for rows.Next() {
		f, err := scanFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	return files, rows.Err()
}

func (r *Repository) CountFiles(parentID *string) (int, error) {
	var n int
	var err error
	if parentID == nil {
		err = r.db.QueryRow("SELECT COUNT(*) FROM files WHERE parent_id IS NULL AND deleted_at IS NULL").Scan(&n)
	} else {
		err = r.db.QueryRow("SELECT COUNT(*) FROM files WHERE parent_id = ? AND deleted_at IS NULL", *parentID).Scan(&n)
	}
	return n, err
}

func (r *Repository) CreateFile(f *model.File) error {
	_, err := r.db.Exec("INSERT INTO files (id, name, parent_id, is_folder, file_id, message_id, mime_type, size, encrypted, created_at, updated_at, share_token, share_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		f.ID, f.Name, f.ParentID, f.IsFolder, f.FileID, f.MessageID, f.MimeType, f.Size, f.Encrypted, f.CreatedAt, f.UpdatedAt, f.ShareToken, f.ShareExpiresAt)
	return err
}

func (r *Repository) GetFile(id string) (*model.File, error) {
	row := r.db.QueryRow("SELECT "+fileColumns+" FROM files WHERE id = ? AND deleted_at IS NULL", id)
	return scanFile(row)
}

func (r *Repository) GetFileAny(id string) (*model.File, error) {
	row := r.db.QueryRow("SELECT "+fileColumns+" FROM files WHERE id = ?", id)
	return scanFile(row)
}

func (r *Repository) GetFileByShareToken(token string) (*model.File, error) {
	row := r.db.QueryRow("SELECT "+fileColumns+" FROM files WHERE share_token = ? AND deleted_at IS NULL", token)
	return scanFile(row)
}

func (r *Repository) UpdateFile(f *model.File) error {
	_, err := r.db.Exec("UPDATE files SET name = ?, parent_id = ?, file_id = ?, message_id = ?, mime_type = ?, size = ?, updated_at = ?, share_token = ?, share_expires_at = ? WHERE id = ?",
		f.Name, f.ParentID, f.FileID, f.MessageID, f.MimeType, f.Size, f.UpdatedAt, f.ShareToken, f.ShareExpiresAt, f.ID)
	return err
}

func (r *Repository) SoftDelete(id string, ts int64) error {
	_, err := r.db.Exec("UPDATE files SET deleted_at = ?, updated_at = ? WHERE id = ?", ts, ts, id)
	return err
}

func (r *Repository) RestoreFile(id string) error {
	_, err := r.db.Exec("UPDATE files SET deleted_at = NULL WHERE id = ?", id)
	return err
}

func (r *Repository) PermanentDelete(id string) error {
	_, err := r.db.Exec("DELETE FROM files WHERE id = ?", id)
	return err
}

func (r *Repository) ListTrash() ([]model.File, error) {
	rows, err := r.db.Query("SELECT " + fileColumns + " FROM files WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := []model.File{}
	for rows.Next() {
		f, err := scanFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	return files, rows.Err()
}

func (r *Repository) RevokeShareLink(id string) error {
	_, err := r.db.Exec("UPDATE files SET share_token = NULL, share_expires_at = NULL WHERE id = ?", id)
	return err
}

func (r *Repository) Search(query string) ([]model.File, error) {
	pattern := "%" + strings.ToLower(query) + "%"
	rows, err := r.db.Query("SELECT "+fileColumns+" FROM files WHERE deleted_at IS NULL AND LOWER(name) LIKE ? ORDER BY is_folder DESC, name ASC LIMIT 500", pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := []model.File{}
	for rows.Next() {
		f, err := scanFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	return files, rows.Err()
}

// CountByFileID menghitung berapa baris (termasuk yang ada di trash) yang
// mereferensikan file_id Telegram tertentu. Dipakai untuk menentukan apakah
// pesan Telegram aman dihapus (tidak ada referensi lain).
func (r *Repository) CountByFileID(fileID string) (int, error) {
	var n int
	err := r.db.QueryRow("SELECT COUNT(*) FROM files WHERE file_id = ?", fileID).Scan(&n)
	return n, err
}

// ListActiveFileIDs mengembalikan set file_id Telegram yang masih direferensikan
// oleh file aktif (deleted_at IS NULL). Dipakai untuk mem-prune thumbnail cache.
func (r *Repository) ListActiveFileIDs() (map[string]bool, error) {
	rows, err := r.db.Query("SELECT file_id FROM files WHERE deleted_at IS NULL AND file_id IS NOT NULL")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids[id] = true
	}
	return ids, rows.Err()
}

// GetAllActivePaths membangun peta id -> path lengkap (mis. "Folder / Sub")
// untuk seluruh file aktif. Dipakai endpoint pencarian agar frontend tidak
// perlu request tambahan per item.
func (r *Repository) GetAllActivePaths() (map[string]string, error) {
	rows, err := r.db.Query("SELECT " + fileColumns + " FROM files WHERE deleted_at IS NULL")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byID := make(map[string]*model.File)
	for rows.Next() {
		f, err := scanFile(rows)
		if err != nil {
			return nil, err
		}
		byID[f.ID] = f
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	paths := make(map[string]string, len(byID))
	var resolve func(id string, depth int) string
	resolve = func(id string, depth int) string {
		f, ok := byID[id]
		if !ok || depth > 100 {
			return ""
		}
		if f.ParentID == nil {
			return "My Drive"
		}
		parent := resolve(*f.ParentID, depth+1)
		if parent == "" {
			return "My Drive"
		}
		return parent + " / " + byID[*f.ParentID].Name
	}
	for id := range byID {
		paths[id] = resolve(id, 0)
	}
	return paths, nil
}
