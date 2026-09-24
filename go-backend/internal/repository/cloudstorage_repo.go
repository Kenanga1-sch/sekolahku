package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

// ErrCloudNotFound dikembalikan bila file tidak ada ATAU bukan milik owner
// yang meminta (isolasi antar-user: bedakan dari 403 agar keberadaan file
// milik user lain tidak bocor).
var ErrCloudNotFound = errors.New("cloud file not found")

// CloudStorageRepository menangani metadata file/folder Cloud Storage.
// SEMUA operasi yang menyentuh file milik user WAJIB menyertakan ownerID.
type CloudStorageRepository struct {
	DB *sql.DB
}

func NewCloudStorageRepository(db *sql.DB) *CloudStorageRepository {
	return &CloudStorageRepository{DB: db}
}

const cloudFileColumns = "id, owner_id, name, parent_id, is_folder, file_id, message_id, mime_type, size, encrypted, created_at, updated_at, deleted_at, share_token, share_expires_at, is_starred, accessed_at, sort_order, share_kind"

func scanCloudFile(row interface {
	Scan(dest ...interface{}) error
}) (*models.CloudFile, error) {
	var f models.CloudFile
	var parentID, fileID, shareToken, shareKind sql.NullString
	var messageID, deletedAt, shareExpires, accessedAt sql.NullInt64
	var encrypted, isStarred int
	err := row.Scan(
		&f.ID, &f.OwnerID, &f.Name, &parentID, &f.IsFolder, &fileID, &messageID,
		&f.MimeType, &f.Size, &encrypted, &f.CreatedAt, &f.UpdatedAt,
		&deletedAt, &shareToken, &shareExpires, &isStarred, &accessedAt, &f.SortOrder, &shareKind,
	)
	if err != nil {
		return nil, err
	}
	if parentID.Valid {
		f.ParentID = &parentID.String
	}
	if fileID.Valid {
		f.FileID = &fileID.String
	}
	if messageID.Valid {
		f.MessageID = &messageID.Int64
	}
	if deletedAt.Valid {
		f.DeletedAt = &deletedAt.Int64
	}
	if shareToken.Valid {
		f.ShareToken = &shareToken.String
	}
	if shareExpires.Valid {
		f.ShareExpiresAt = &shareExpires.Int64
	}
	if accessedAt.Valid {
		f.AccessedAt = &accessedAt.Int64
	}
	if shareKind.Valid {
		f.ShareKind = &shareKind.String
	}
	f.Encrypted = encrypted != 0
	f.IsStarred = isStarred != 0
	return &f, nil
}

// ListFiles mengembalikan isi satu folder (deleted_at IS NULL) milik owner.
func (r *CloudStorageRepository) ListFiles(ownerID string, parentID *string, limit, offset int) ([]models.CloudFile, error) {
	query := "SELECT " + cloudFileColumns + " FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL AND "
	args := []interface{}{ownerID}
	if parentID == nil {
		query += "parent_id IS NULL"
	} else {
		query += "parent_id = ?"
		args = append(args, *parentID)
	}
	query += " ORDER BY is_folder DESC, name COLLATE NOCASE ASC"
	if limit > 0 {
		query += " LIMIT ? OFFSET ?"
		args = append(args, limit, offset)
	}

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := []models.CloudFile{}
	for rows.Next() {
		f, err := scanCloudFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	return files, rows.Err()
}

// CountFiles menghitung item pada folder (deleted_at IS NULL).
func (r *CloudStorageRepository) CountFiles(ownerID string, parentID *string) (int, error) {
	var n int
	var err error
	if parentID == nil {
		err = r.DB.QueryRow("SELECT COUNT(*) FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL AND parent_id IS NULL", ownerID).Scan(&n)
	} else {
		err = r.DB.QueryRow("SELECT COUNT(*) FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL AND parent_id = ?", ownerID, *parentID).Scan(&n)
	}
	return n, err
}

// SumSizeByOwner menghitung total ukuran file aktif milik owner (untuk indikator pemakaian).
func (r *CloudStorageRepository) SumSizeByOwner(ownerID string) (int64, int, error) {
	var total sql.NullInt64
	var count int
	err := r.DB.QueryRow(
		"SELECT COALESCE(SUM(size),0), COUNT(*) FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL AND is_folder = 0",
		ownerID,
	).Scan(&total, &count)
	return total.Int64, count, err
}

// GetFile mengambil file aktif milik owner. Bila bukan milik owner → ErrCloudNotFound.
func (r *CloudStorageRepository) GetFile(ownerID, id string) (*models.CloudFile, error) {
	row := r.DB.QueryRow("SELECT "+cloudFileColumns+" FROM cloud_files WHERE id = ? AND owner_id = ? AND deleted_at IS NULL", id, ownerID)
	f, err := scanCloudFile(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCloudNotFound
	}
	return f, err
}

// GetFileAny mengambil file (termasuk di trash) milik owner.
func (r *CloudStorageRepository) GetFileAny(ownerID, id string) (*models.CloudFile, error) {
	row := r.DB.QueryRow("SELECT "+cloudFileColumns+" FROM cloud_files WHERE id = ? AND owner_id = ?", id, ownerID)
	f, err := scanCloudFile(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCloudNotFound
	}
	return f, err
}

// GetByShareToken mengambil file aktif berdasarkan token share (tanpa owner —
// dipakai endpoint publik). Token unik secara global.
func (r *CloudStorageRepository) GetByShareToken(token string) (*models.CloudFile, error) {
	row := r.DB.QueryRow("SELECT "+cloudFileColumns+" FROM cloud_files WHERE share_token = ? AND deleted_at IS NULL", token)
	f, err := scanCloudFile(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCloudNotFound
	}
	return f, err
}

// Create membuat baris file. Mengembalikan error; konflik nama unik terdeteksi
// lewat IsCloudUniqueConstraint.
func (r *CloudStorageRepository) Create(f *models.CloudFile) error {
	enc := 0
	if f.Encrypted {
		enc = 1
	}
	_, err := r.DB.Exec(
		"INSERT INTO cloud_files (id, owner_id, name, parent_id, is_folder, file_id, message_id, mime_type, size, encrypted, created_at, updated_at, deleted_at, share_token, share_expires_at, is_starred, accessed_at, sort_order, share_kind) "+
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		f.ID, f.OwnerID, f.Name, f.ParentID, boolToInt(f.IsFolder), f.FileID, f.MessageID,
		f.MimeType, f.Size, enc, f.CreatedAt, f.UpdatedAt, f.DeletedAt, f.ShareToken, f.ShareExpiresAt,
		boolToInt(f.IsStarred), f.AccessedAt, f.SortOrder, f.ShareKind,
	)
	return err
}

// Update memperbarui name/parent/updated_at/file_id/message_id milik owner.
func (r *CloudStorageRepository) Update(f *models.CloudFile) error {
	res, err := r.DB.Exec(
		"UPDATE cloud_files SET name = ?, parent_id = ?, file_id = ?, message_id = ?, mime_type = ?, size = ?, updated_at = ?, share_token = ?, share_expires_at = ?, is_starred = ?, accessed_at = ?, sort_order = ?, share_kind = ? WHERE id = ? AND owner_id = ?",
		f.Name, f.ParentID, f.FileID, f.MessageID, f.MimeType, f.Size, f.UpdatedAt, f.ShareToken, f.ShareExpiresAt,
		boolToInt(f.IsStarred), f.AccessedAt, f.SortOrder, f.ShareKind, f.ID, f.OwnerID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrCloudNotFound
	}
	return nil
}

// SoftDelete menandai file (satu baris) sebagai terhapus.
func (r *CloudStorageRepository) SoftDelete(ownerID, id string, ts int64) error {
	_, err := r.DB.Exec("UPDATE cloud_files SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?", ts, ts, id, ownerID)
	return err
}

// Restore mengembalikan file dari trash.
func (r *CloudStorageRepository) Restore(ownerID, id string, ts int64) error {
	_, err := r.DB.Exec("UPDATE cloud_files SET deleted_at = NULL, updated_at = ? WHERE id = ? AND owner_id = ?", ts, id, ownerID)
	return err
}

// PermanentDelete menghapus baris secara permanen (satu baris).
func (r *CloudStorageRepository) PermanentDelete(ownerID, id string) error {
	_, err := r.DB.Exec("DELETE FROM cloud_files WHERE id = ? AND owner_id = ?", id, ownerID)
	return err
}

// ListChildren mengembalikan seluruh anak langsung dari sebuah folder, apa pun
// status trash-nya (dipakai untuk cascade).
func (r *CloudStorageRepository) ListChildren(ownerID, parentID string) ([]models.CloudFile, error) {
	rows, err := r.DB.Query("SELECT "+cloudFileColumns+" FROM cloud_files WHERE owner_id = ? AND parent_id = ?", ownerID, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	files := []models.CloudFile{}
	for rows.Next() {
		f, err := scanCloudFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	return files, rows.Err()
}

// ListTrash mengembalikan seluruh item di trash milik owner.
func (r *CloudStorageRepository) ListTrash(ownerID string) ([]models.CloudFile, error) {
	rows, err := r.DB.Query("SELECT "+cloudFileColumns+" FROM cloud_files WHERE owner_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC", ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	files := []models.CloudFile{}
	for rows.Next() {
		f, err := scanCloudFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	return files, rows.Err()
}

// UsedNames mengembalikan himpunan nama yang sudah dipakai di folder tertentu
// (item aktif), kecuali excludeID. Dipakai untuk dedup nama.
func (r *CloudStorageRepository) UsedNames(ownerID string, parentID *string, excludeID string) (map[string]bool, error) {
	query := "SELECT name, id FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL AND "
	args := []interface{}{ownerID}
	if parentID == nil {
		query += "parent_id IS NULL"
	} else {
		query += "parent_id = ?"
		args = append(args, *parentID)
	}
	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	used := map[string]bool{}
	for rows.Next() {
		var name, id string
		if err := rows.Scan(&name, &id); err != nil {
			return nil, err
		}
		if id != excludeID {
			used[name] = true
		}
	}
	return used, rows.Err()
}

// Search mencari file/folder berdasarkan nama (rekursif) milik owner.
func (r *CloudStorageRepository) Search(ownerID, query string) ([]models.CloudFile, error) {
	// Hindari LIKE wildcard berlebih.
	q := "%" + strings.ReplaceAll(strings.ReplaceAll(query, "%", "\\%"), "_", "\\_") + "%"
	rows, err := r.DB.Query(
		"SELECT "+cloudFileColumns+" FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL AND name LIKE ? ESCAPE '\\' ORDER BY is_folder DESC, name COLLATE NOCASE ASC LIMIT 200",
		ownerID, q,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	files := []models.CloudFile{}
	for rows.Next() {
		f, err := scanCloudFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	r.AttachPaths(ownerID, files)
	return files, nil
}

// AttachPaths mengisi Path (mis. "Folder / Subfolder") untuk hasil search.
func (r *CloudStorageRepository) AttachPaths(ownerID string, files []models.CloudFile) {
	// Bangun peta id → (name, parent) dari seluruh item aktif owner sekali saja.
	rows, err := r.DB.Query("SELECT id, name, parent_id FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL", ownerID)
	if err != nil {
		return
	}
	defer rows.Close()
	nodes := map[string]cloudNode{}
	for rows.Next() {
		var id, name string
		var parent sql.NullString
		if err := rows.Scan(&id, &name, &parent); err != nil {
			return
		}
		n := cloudNode{name: name}
		if parent.Valid {
			p := parent.String
			n.parent = &p
		}
		nodes[id] = n
	}
	for i := range files {
		files[i].Path = buildCloudPath(nodes, files[i].ID)
	}
}

// cloudNode menyimpan nama & parent untuk resolusi path.
type cloudNode struct {
	name   string
	parent *string
}

// buildCloudPath menyusun string path "Ancestor / ... / name" dari peta node.
func buildCloudPath(nodes map[string]cloudNode, id string) string {
	var parts []string
	seen := map[string]bool{}
	curr := id
	for {
		n, ok := nodes[curr]
		if !ok || seen[curr] {
			break
		}
		seen[curr] = true
		parts = append([]string{n.name}, parts...)
		if n.parent == nil {
			break
		}
		curr = *n.parent
	}
	return strings.Join(parts, " / ")
}

// IsCloudUniqueConstraint melaporkan apakah error berasal dari pelanggaran
// unique index nama (owner, parent, name).
func IsCloudUniqueConstraint(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}

// UniqueCloudName mengembalikan nama unik dengan suffix " (N)" bila bentrok,
// memakai ext yang dipertahankan seperti file manager.
func UniqueCloudName(used map[string]bool, name string) string {
	if !used[name] {
		return name
	}
	ext := filepath.Ext(name)
	stem := strings.TrimSuffix(name, ext)
	for i := 1; ; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", stem, i, ext)
		if !used[candidate] {
			return candidate
		}
	}
}

// CloudNow mengembalikan waktu Unix saat ini (helper konsistensi).
func CloudNow() int64 { return time.Now().Unix() }

// ---------------------------------------------------------------------------
// Sortir / filter / favorit / akses terakhir
// ---------------------------------------------------------------------------

// CloudListOptions mengatur sortir & filter untuk listing.
type CloudListOptions struct {
	ParentID *string
	Sort     string // name | size | date_desc | date_asc | manual
	Type     string // all | folder | image | video | audio | pdf | doc | other
	Starred  bool   // hanya favorit
	Limit    int
	Offset   int
}

// cloudSortClause memetakan sort ke ORDER BY yang aman (whitelist, tanpa
// interpolasi input pengguna) — mencegah SQL injection.
func cloudSortClause(sort string) string {
	switch sort {
	case "size":
		return " ORDER BY is_folder DESC, size DESC, name COLLATE NOCASE ASC"
	case "date_desc":
		return " ORDER BY is_folder DESC, updated_at DESC, name COLLATE NOCASE ASC"
	case "date_asc":
		return " ORDER BY is_folder DESC, updated_at ASC, name COLLATE NOCASE ASC"
	case "manual":
		return " ORDER BY is_folder DESC, sort_order ASC, name COLLATE NOCASE ASC"
	case "name":
		fallthrough
	default:
		return " ORDER BY is_folder DESC, name COLLATE NOCASE ASC"
	}
}

// cloudTypeClause memetakan filter jenis ke kondisi SQL (whitelist).
func cloudTypeClause(t string) (string, []interface{}) {
	switch t {
	case "folder":
		return " AND is_folder = 1", nil
	case "image":
		return " AND is_folder = 0 AND mime_type LIKE 'image/%'", nil
	case "video":
		return " AND is_folder = 0 AND mime_type LIKE 'video/%'", nil
	case "audio":
		return " AND is_folder = 0 AND mime_type LIKE 'audio/%'", nil
	case "pdf":
		return " AND is_folder = 0 AND mime_type = 'application/pdf'", nil
	case "doc":
		return " AND is_folder = 0 AND (mime_type LIKE 'text/%' OR mime_type LIKE '%word%' OR mime_type LIKE '%document%' OR mime_type LIKE '%sheet%' OR mime_type LIKE '%excel%' OR mime_type LIKE '%presentation%' OR mime_type LIKE '%powerpoint%')", nil
	case "other":
		return " AND is_folder = 0 AND NOT (mime_type LIKE 'image/%' OR mime_type LIKE 'video/%' OR mime_type LIKE 'audio/%' OR mime_type = 'application/pdf' OR mime_type LIKE 'text/%')", nil
	default:
		return "", nil
	}
}

// ListFilesFiltered mengembalikan isi folder dengan sortir & filter.
func (r *CloudStorageRepository) ListFilesFiltered(ownerID string, opts CloudListOptions) ([]models.CloudFile, error) {
	query := "SELECT " + cloudFileColumns + " FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL"
	args := []interface{}{ownerID}
	if opts.ParentID == nil {
		query += " AND parent_id IS NULL"
	} else {
		query += " AND parent_id = ?"
		args = append(args, *opts.ParentID)
	}
	if opts.Starred {
		query += " AND is_starred = 1"
	}
	typeClause, typeArgs := cloudTypeClause(opts.Type)
	query += typeClause
	args = append(args, typeArgs...)

	query += cloudSortClause(opts.Sort)
	if opts.Limit > 0 {
		query += " LIMIT ? OFFSET ?"
		args = append(args, opts.Limit, opts.Offset)
	}

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	files := []models.CloudFile{}
	for rows.Next() {
		f, err := scanCloudFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	return files, rows.Err()
}

// CountFilesFiltered menghitung item yang cocok filter (untuk paginasi).
func (r *CloudStorageRepository) CountFilesFiltered(ownerID string, opts CloudListOptions) (int, error) {
	query := "SELECT COUNT(*) FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL"
	args := []interface{}{ownerID}
	if opts.ParentID == nil {
		query += " AND parent_id IS NULL"
	} else {
		query += " AND parent_id = ?"
		args = append(args, *opts.ParentID)
	}
	if opts.Starred {
		query += " AND is_starred = 1"
	}
	typeClause, typeArgs := cloudTypeClause(opts.Type)
	query += typeClause
	args = append(args, typeArgs...)

	var n int
	err := r.DB.QueryRow(query, args...).Scan(&n)
	return n, err
}

// ListStarred mengembalikan seluruh item favorit owner (lintas folder).
func (r *CloudStorageRepository) ListStarred(ownerID string) ([]models.CloudFile, error) {
	return r.queryList(
		"SELECT "+cloudFileColumns+" FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL AND is_starred = 1 ORDER BY is_folder DESC, name COLLATE NOCASE ASC LIMIT 500",
		ownerID,
	)
}

// ListRecent mengembalikan item yang baru diakses/diubah (view "Terbaru").
func (r *CloudStorageRepository) ListRecent(ownerID string) ([]models.CloudFile, error) {
	return r.queryList(
		"SELECT "+cloudFileColumns+" FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL AND is_folder = 0 ORDER BY COALESCE(accessed_at, updated_at) DESC LIMIT 100",
		ownerID,
	)
}

// ListLarge mengembalikan berkas terbesar (view "Ukuran besar").
func (r *CloudStorageRepository) ListLarge(ownerID string) ([]models.CloudFile, error) {
	return r.queryList(
		"SELECT "+cloudFileColumns+" FROM cloud_files WHERE owner_id = ? AND deleted_at IS NULL AND is_folder = 0 ORDER BY size DESC LIMIT 100",
		ownerID,
	)
}

// queryList menjalankan query yang mengembalikan banyak baris cloud_files.
func (r *CloudStorageRepository) queryList(query string, args ...interface{}) ([]models.CloudFile, error) {
	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	files := []models.CloudFile{}
	for rows.Next() {
		f, err := scanCloudFile(rows)
		if err != nil {
			return nil, err
		}
		files = append(files, *f)
	}
	return files, rows.Err()
}

// SetStarred menetapkan status favorit satu item milik owner.
func (r *CloudStorageRepository) SetStarred(ownerID, id string, starred bool, ts int64) error {
	res, err := r.DB.Exec(
		"UPDATE cloud_files SET is_starred = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
		boolToInt(starred), ts, id, ownerID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrCloudNotFound
	}
	return nil
}

// TouchAccessed mencatat waktu akses terakhir sebuah berkas.
func (r *CloudStorageRepository) TouchAccessed(ownerID, id string, ts int64) error {
	_, err := r.DB.Exec(
		"UPDATE cloud_files SET accessed_at = ? WHERE id = ? AND owner_id = ?",
		ts, id, ownerID,
	)
	return err
}

// MaxSortOrder mengembalikan nilai sort_order tertinggi pada sebuah folder
// (dipakai saat menambahkan item baru di mode urutan manual).
func (r *CloudStorageRepository) MaxSortOrder(ownerID string, parentID *string) (int64, error) {
	var maxOrder sql.NullInt64
	var err error
	if parentID == nil {
		err = r.DB.QueryRow("SELECT MAX(sort_order) FROM cloud_files WHERE owner_id = ? AND parent_id IS NULL AND deleted_at IS NULL", ownerID).Scan(&maxOrder)
	} else {
		err = r.DB.QueryRow("SELECT MAX(sort_order) FROM cloud_files WHERE owner_id = ? AND parent_id = ? AND deleted_at IS NULL", ownerID, *parentID).Scan(&maxOrder)
	}
	if err != nil {
		return 0, err
	}
	return maxOrder.Int64, nil
}

// SetSortOrders menetapkan urutan manual untuk sekumpulan item milik owner.
func (r *CloudStorageRepository) SetSortOrders(ownerID string, orders map[string]int64, ts int64) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	for id, order := range orders {
		if _, err := tx.Exec(
			"UPDATE cloud_files SET sort_order = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
			order, ts, id, ownerID,
		); err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}
