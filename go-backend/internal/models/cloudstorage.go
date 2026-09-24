package models

// CloudFile adalah metadata satu file/folder di Cloud Storage. Isi file
// sebenarnya tersimpan di Telegram (file_id/message_id); tabel ini hanya
// menyimpan metadata dan struktur folder per owner.
type CloudFile struct {
	ID             string  `json:"id"`
	OwnerID        string  `json:"owner_id"`
	Name           string  `json:"name"`
	Path           string  `json:"path,omitempty"` // lokasi lengkap (hasil search)
	ParentID       *string `json:"parent_id,omitempty"`
	IsFolder       bool    `json:"is_folder"`
	FileID         *string `json:"file_id,omitempty"`
	MessageID      *int64  `json:"message_id,omitempty"`
	MimeType       string  `json:"mime_type"`
	Size           int64   `json:"size"`
	Encrypted      bool    `json:"encrypted"`
	CreatedAt      int64   `json:"created_at"`
	UpdatedAt      int64   `json:"updated_at"`
	DeletedAt      *int64  `json:"deleted_at,omitempty"`
	ShareToken     *string `json:"share_token,omitempty"`
	ShareExpiresAt *int64  `json:"share_expires_at,omitempty"`
	IsStarred      bool    `json:"is_starred"`
	AccessedAt     *int64  `json:"accessed_at,omitempty"`
	SortOrder      int64   `json:"sort_order"`
	ShareKind      *string `json:"share_kind,omitempty"`
}
