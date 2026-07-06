package models

type SchoolDocument struct {
	ID           string  `json:"id" db:"id"`
	DocumentType string  `json:"documentType" db:"document_type"`
	Title        string  `json:"title" db:"title"`
	Recipient    string  `json:"recipient" db:"recipient"`
	ReferenceID  *string `json:"referenceId" db:"reference_id"`
	FilePath     string  `json:"filePath" db:"file_path"`
	CreatedBy    *string `json:"createdBy" db:"created_by"`
	CreatedAt    int64   `json:"createdAt" db:"created_at"`
	UpdatedAt    int64   `json:"updatedAt" db:"updated_at"`
}
