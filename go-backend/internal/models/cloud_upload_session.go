package models

// CloudUploadSession melacak progress upload bertahap (chunked) file besar.
type CloudUploadSession struct {
	ID             string  `json:"id"`
	OwnerID        string  `json:"owner_id"`
	FileName       string  `json:"file_name"`
	MimeType       string  `json:"mime_type"`
	ParentID       *string `json:"parent_id,omitempty"`
	TotalSize      int64   `json:"total_size"`
	TotalChunks    int     `json:"total_chunks"`
	ChunkSize      int64   `json:"chunk_size"`
	UploadedChunks int     `json:"uploaded_chunks"`
	Encrypted      bool    `json:"encrypted"`
	Status         string  `json:"status"`
	Error          string  `json:"error,omitempty"`
	CreatedAt      int64   `json:"created_at"`
	UpdatedAt      int64   `json:"updated_at"`
	// UploadedIndexes: indeks potongan yang ada di server (diisi saat GET status,
	// bukan dari kolom DB). MissingChunks: indeks yang belum diterima. Keduanya
	// diisi dari berkas nyata di disk sehingga resume tetap akurat.
	UploadedIndexes []int `json:"uploaded_indexes,omitempty"`
	MissingChunks   []int `json:"missing_chunks,omitempty"`
}

// Status sesi upload bertahap.
const (
	UploadStatusUploading = "uploading"
	UploadStatusMerging   = "merging"
	UploadStatusDone      = "done"
	UploadStatusFailed    = "failed"
)
