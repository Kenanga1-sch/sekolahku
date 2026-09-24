package model

type File struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Path           string  `json:"path,omitempty"`
	ParentID       *string `json:"parent_id,omitempty"`
	IsFolder       bool    `json:"is_folder"`
	IsFavorite     bool    `json:"is_favorite"`
	FileID         *string `json:"file_id,omitempty"`
	MessageID      *int64  `json:"message_id,omitempty"`
	MimeType       string  `json:"mime_type"`
	Size           int64   `json:"size"`
	Encrypted      bool    `json:"encrypted"`
	CreatedAt      int64   `json:"created_at"`
	UpdatedAt      int64   `json:"updated_at"`
	AccessedAt     int64   `json:"accessed_at"`
	DeletedAt      *int64  `json:"deleted_at,omitempty"`
	ShareToken     *string `json:"share_token,omitempty"`
	ShareExpiresAt *int64  `json:"share_expires_at,omitempty"`
}

type CreateFolderRequest struct {
	Name     string  `json:"name"`
	ParentID *string `json:"parent_id,omitempty"`
}

type RenameRequest struct {
	Name string `json:"name"`
}

type CopyMoveRequest struct {
	IDs      []string `json:"ids"`
	TargetID *string  `json:"target_id,omitempty"`
}

type UploadError struct {
	Name  string `json:"name"`
	Error string `json:"error"`
}

type UploadResponse struct {
	Files  []File        `json:"files"`
	Errors []UploadError `json:"errors,omitempty"`
}
