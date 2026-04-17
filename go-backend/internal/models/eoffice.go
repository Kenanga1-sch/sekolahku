package models

import "time"

// GeneratedLetter represents an issued letter log
type GeneratedLetter struct {
	ID                 string     `json:"id"`
	LetterNumber       string     `json:"letterNumber"`
	ClassificationCode *string    `json:"classificationCode"`
	SequenceNumber     int        `json:"sequenceNumber"`
	Recipient          *string    `json:"recipient"`
	TemplateID         *string    `json:"templateId"`
	CreatedAt          *time.Time `json:"createdAt"`
}

type LetterTemplate struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Category    string     `json:"category"`
	Content     *string    `json:"content"`
	FilePath    *string    `json:"filePath"`
	Type        string     `json:"type"` // EDITOR or UPLOAD
	PaperSize   string     `json:"paperSize"`
	Orientation string     `json:"orientation"`
	IsActive    bool       `json:"isActive"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

type LetterTemplateResponse struct {
	Data []LetterTemplate `json:"data"`
	Total int            `json:"total"`
}

type NumberingRequest struct {
	ClassificationCode *string `json:"classificationCode"`
	Date               *string `json:"date"` // Optional ISO date string
}

type NumberingResponse struct {
	NextSequence int `json:"nextSequence"`
}

type IncrementRequest struct {
	LetterNumber       string  `json:"letterNumber"`
	SequenceNumber     int     `json:"sequenceNumber"`
	TemplateID         *string `json:"templateId"`
	Recipient          *string `json:"recipient"`
	ClassificationCode *string `json:"classificationCode"`
}

// Announcement struct moved to announcement.go


// ContactMessage moved to contact.go

// E-Arsip
type KlasifikasiSurat struct {
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsActive    bool    `json:"isActive"`
}

type SuratMasuk struct {
	ID                 string            `json:"id"`
	AgendaNumber       string            `json:"agendaNumber"`
	OriginalNumber     string            `json:"originalNumber"`
	Sender             string            `json:"sender"`
	Subject            string            `json:"subject"`
	DateOfLetter       string            `json:"dateOfLetter"`
	ReceivedAt         *time.Time        `json:"receivedAt"`
	ClassificationCode *string           `json:"classificationCode"`
	Classification     *KlasifikasiSurat `json:"classification,omitempty"`
	FilePath           string            `json:"filePath"`
	Status             string            `json:"status"`
	Notes              *string           `json:"notes"`
	CreatedAt          *time.Time        `json:"createdAt"`
	UpdatedAt          *time.Time        `json:"updatedAt"`
}

type SuratKeluar struct {
	ID                 string            `json:"id"`
	MailNumber         string            `json:"mailNumber"`
	Recipient          string            `json:"recipient"`
	Subject            string            `json:"subject"`
	DateOfLetter       string            `json:"dateOfLetter"`
	ClassificationCode *string           `json:"classificationCode"`
	Classification     *KlasifikasiSurat `json:"classification,omitempty"`
	FilePath           *string           `json:"filePath"`
	FinalFilePath      *string           `json:"finalFilePath"`
	Status             string            `json:"status"`
	CreatedBy          *string           `json:"createdBy"`
	CreatedAt          *time.Time        `json:"createdAt"`
	UpdatedAt          *time.Time        `json:"updatedAt"`
}

type Disposisi struct {
	ID             string     `json:"id"`
	SuratMasukID   string     `json:"suratMasukId"`
	FromUserID     string     `json:"fromUserId"`
	FromUser       *User      `json:"fromUser,omitempty"`
	ToUserID       string     `json:"toUserId"`
	ToUser         *User      `json:"toUser,omitempty"`
	Instruction    string     `json:"instruction"`
	Deadline       *string    `json:"deadline"`
	IsCompleted    bool       `json:"isCompleted"`
	CompletedAt    *time.Time `json:"completedAt"`
	CompletedNote  *string    `json:"completedNote"`
	CreatedAt      *time.Time `json:"createdAt"`
}

type ArsipStats struct {
	SuratMasuk   int `json:"suratMasuk"`
	SuratKeluar   int `json:"suratKeluar"`
	PendingTasks int `json:"pendingTasks"`
}
