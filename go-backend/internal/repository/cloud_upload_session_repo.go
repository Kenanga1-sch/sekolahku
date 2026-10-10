package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

// ErrUploadSessionNotFound dikembalikan bila sesi tidak ada atau bukan milik
// owner yang meminta (isolasi antar-user).
var ErrUploadSessionNotFound = errors.New("upload session not found")

type CloudUploadSessionRepository struct {
	DB *sql.DB
}

func NewCloudUploadSessionRepository(db *sql.DB) *CloudUploadSessionRepository {
	return &CloudUploadSessionRepository{DB: db}
}

const uploadSessionColumns = "id, owner_id, file_name, mime_type, parent_id, total_size, total_chunks, chunk_size, uploaded_chunks, encrypted, status, error, created_at, updated_at"

func scanUploadSession(row interface {
	Scan(dest ...interface{}) error
}) (*models.CloudUploadSession, error) {
	var s models.CloudUploadSession
	var parentID, sessErr sql.NullString
	var encrypted int
	err := row.Scan(
		&s.ID, &s.OwnerID, &s.FileName, &s.MimeType, &parentID,
		&s.TotalSize, &s.TotalChunks, &s.ChunkSize, &s.UploadedChunks,
		&encrypted, &s.Status, &sessErr, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if parentID.Valid {
		s.ParentID = &parentID.String
	}
	if sessErr.Valid {
		s.Error = sessErr.String
	}
	s.Encrypted = encrypted == 1
	return &s, nil
}

// Create menyimpan sesi upload baru.
func (r *CloudUploadSessionRepository) Create(s *models.CloudUploadSession) error {
	enc := 0
	if s.Encrypted {
		enc = 1
	}
	now := time.Now().Unix()
	_, err := r.DB.Exec(`
		INSERT INTO cloud_upload_sessions
			(id, owner_id, file_name, mime_type, parent_id, total_size, total_chunks, chunk_size, uploaded_chunks, encrypted, status, error, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, '', ?, ?)`,
		s.ID, s.OwnerID, s.FileName, s.MimeType, s.ParentID,
		s.TotalSize, s.TotalChunks, s.ChunkSize, enc, s.Status, now, now,
	)
	return err
}

// Get milik owner tertentu.
func (r *CloudUploadSessionRepository) Get(ownerID, id string) (*models.CloudUploadSession, error) {
	s, err := scanUploadSession(r.DB.QueryRow(
		`SELECT `+uploadSessionColumns+` FROM cloud_upload_sessions WHERE id = ? AND owner_id = ?`, id, ownerID))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrUploadSessionNotFound
		}
		return nil, err
	}
	return s, nil
}

// AddChunk menambah hitungan potongan selesai secara atomik dan mengembalikan
// jumlah terkini. Aman dipanggil konkuren: UPDATE ... RETURNING mengunci baris.
func (r *CloudUploadSessionRepository) AddChunk(ownerID, id string) (int, error) {
	var uploaded int
	err := r.DB.QueryRow(`
		UPDATE cloud_upload_sessions
		SET uploaded_chunks = uploaded_chunks + 1, updated_at = ?
		WHERE id = ? AND owner_id = ? AND status = ?
		RETURNING uploaded_chunks`,
		time.Now().Unix(), id, ownerID, models.UploadStatusUploading,
	).Scan(&uploaded)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, ErrUploadSessionNotFound
		}
		return 0, err
	}
	return uploaded, nil
}

// SetStatus memperbarui status (+ pesan error opsional).
func (r *CloudUploadSessionRepository) SetStatus(ownerID, id, status, errMsg string) error {
	_, err := r.DB.Exec(`
		UPDATE cloud_upload_sessions SET status = ?, error = ?, updated_at = ?
		WHERE id = ? AND owner_id = ?`,
		status, errMsg, time.Now().Unix(), id, ownerID)
	return err
}

// Delete menghapus sesi (setelah complete atau dibatalkan).
func (r *CloudUploadSessionRepository) Delete(ownerID, id string) error {
	_, err := r.DB.Exec(`DELETE FROM cloud_upload_sessions WHERE id = ? AND owner_id = ?`, id, ownerID)
	return err
}

// ListStale mengembalikan sesi yang terhenti lebih dari maxAge detik dan masih
// berstatus uploading/merging (untuk cleanup file sementara).
func (r *CloudUploadSessionRepository) ListStale(maxAge int64) ([]models.CloudUploadSession, error) {
	cutoff := time.Now().Unix() - maxAge
	rows, err := r.DB.Query(`
		SELECT `+uploadSessionColumns+` FROM cloud_upload_sessions
		WHERE updated_at < ? AND status IN (?, ?)`, cutoff,
		models.UploadStatusUploading, models.UploadStatusMerging)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.CloudUploadSession
	for rows.Next() {
		s, err := scanUploadSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, nil
}
