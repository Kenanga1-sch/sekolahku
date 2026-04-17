package models

import "time"

// Alumni represents a former student record
type Alumni struct {
	ID             string            `json:"id"`
	StudentID      *string           `json:"studentId"`
	NISN           *string           `json:"nisn"`
	NIS            *string           `json:"nis"`
	FullName       string            `json:"fullName"`
	Gender         *string           `json:"gender"`
	BirthPlace     *string           `json:"birthPlace"`
	BirthDate      *string           `json:"birthDate"`
	GraduationYear string            `json:"graduationYear"`
	GraduationDate *time.Time        `json:"graduationDate"`
	FinalClass     *string           `json:"finalClass"`
	Photo          *string           `json:"photo"`
	ParentName     *string           `json:"parentName"`
	ParentPhone    *string           `json:"parentPhone"`
	CurrentAddress *string           `json:"currentAddress"`
	CurrentPhone   *string           `json:"currentPhone"`
	CurrentEmail   *string           `json:"currentEmail"`
	NextSchool     *string           `json:"nextSchool"`
	Notes          *string           `json:"notes"`
	Documents      []AlumniDocument  `json:"documents,omitempty"`
	Pickups        []DocumentPickup `json:"pickups,omitempty"`
	CreatedAt      *time.Time        `json:"createdAt"`
	UpdatedAt      *time.Time        `json:"updatedAt"`
}

// AlumniDocumentType defines types of documents e.g. Ijazah, SKHUN
type AlumniDocumentType struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Code          string  `json:"code"`
	Description   *string `json:"description"`
	IsRequired    bool    `json:"isRequired"`
	MaxFileSizeMB int     `json:"maxFileSizeMb"`
	AllowedTypes  string  `json:"allowedTypes"` // JSON array string
	SortOrder     int     `json:"sortOrder"`
}

// AlumniDocument represents a file uploaded for an alumni
type AlumniDocument struct {
	ID                 string              `json:"id"`
	AlumniID           string              `json:"alumniId"`
	DocumentTypeID     string              `json:"documentTypeId"`
	DocumentType       *AlumniDocumentType `json:"documentType,omitempty"`
	FileName           string              `json:"fileName"`
	FilePath           string              `json:"filePath"`
	FileSize           int                 `json:"fileSize"`
	MimeType           string              `json:"mimeType"`
	DocumentNumber     *string             `json:"documentNumber"`
	IssueDate          *string             `json:"issueDate"`
	VerificationStatus string              `json:"verificationStatus"` // pending, verified, rejected
	VerifiedBy         *string             `json:"verifiedBy"`
	VerifiedAt         *time.Time          `json:"verifiedAt"`
	VerificationNotes  *string             `json:"verificationNotes"`
	Notes              *string             `json:"notes"`
	UploadedBy         *string             `json:"uploadedBy"`
	CreatedAt          *time.Time          `json:"createdAt"`
	UpdatedAt          *time.Time          `json:"updatedAt"`
}

// DocumentPickup tracks when physical documents are handed over
type DocumentPickup struct {
	ID                string              `json:"id"`
	AlumniID          string              `json:"alumniId"`
	DocumentTypeID    *string             `json:"documentTypeId"`
	DocumentType      *AlumniDocumentType `json:"documentType,omitempty"`
	RecipientName     string              `json:"recipientName"`
	RecipientRelation *string             `json:"recipientRelation"`
	RecipientIDNumber *string             `json:"recipientIdNumber"`
	RecipientPhone    *string             `json:"recipientPhone"`
	PickupDate        *time.Time          `json:"pickupDate"`
	SignaturePath     *string             `json:"signaturePath"`
	PhotoProofPath    *string             `json:"photoProofPath"`
	Notes             *string             `json:"notes"`
	HandedOverBy      *string             `json:"handedOverBy"`
	CreatedAt         *time.Time          `json:"createdAt"`
}

// AlumniStats represents summary data for the dashboard
type AlumniStats struct {
	TotalAlumni         int `json:"totalAlumni"`
	TotalDocuments      int `json:"totalDocuments"`
	PendingVerification int `json:"pendingVerification"`
}
