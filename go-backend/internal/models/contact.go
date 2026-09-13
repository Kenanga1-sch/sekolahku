package models

import "time"

type ContactMessage struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Subject   string    `json:"subject"`
	Message   string    `json:"message"`
	Category  string    `json:"category"`
	Status    string    `json:"status"`
	Ticket    string    `json:"ticket"`
	IsRead    bool      `json:"isRead"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type SubmitContactRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Subject  string `json:"subject"`
	Message  string `json:"message"`
	Category string `json:"category"`
}

// ContactStatusView bentuk publik untuk cek status tiket: sengaja tanpa
// isi pesan dan data pribadi supaya kode tiket yang bocor tidak membuka
// isi laporan pelapor. ResolutionCount memberi sinyal "sudah ditindaklanjuti
// dengan bukti" tanpa membuka isi buktinya.
type ContactStatusView struct {
	Category        string                  `json:"category"`
	Status          string                  `json:"status"`
	Ticket          string                  `json:"ticket"`
	CreatedAt       time.Time               `json:"createdAt"`
	UpdatedAt       time.Time               `json:"updatedAt"`
	ResolutionCount int                     `json:"resolutionCount"`
	Replies         []ContactStatusReplyView `json:"replies"`
}

// ContactReply balasan tindak lanjut dari admin; dibaca pelapor lewat
// halaman cek status tiket. AuthorName untuk audit internal — tampilan
// publik memakai label "Tim Sekolah", bukan nama asli.
type ContactReply struct {
	ID         string    `json:"id"`
	MessageID  string    `json:"messageId"`
	Body       string    `json:"body"`
	AuthorID   *string   `json:"authorId,omitempty"`
	AuthorName string    `json:"authorName"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ContactStatusReplyView balasan bentuk publik (lihat ContactStatusView).
type ContactStatusReplyView struct {
	Body      string    `json:"body"`
	By        string    `json:"by"`
	CreatedAt time.Time `json:"createdAt"`
}
// ContactAttachment lampiran pesan masuk.
// Kind: "evidence" (dari pelapor) atau "resolution" (bukti tindak lanjut admin).
// FileKind: "image" atau "video".
type ContactAttachment struct {
	ID           string    `json:"id"`
	MessageID    string    `json:"messageId"`
	Kind         string    `json:"kind"`
	FileKind     string    `json:"fileKind"`
	FilePath     string    `json:"filePath"`
	OriginalName string    `json:"originalName"`
	FileSize     int64     `json:"fileSize"`
	MimeType     string    `json:"mimeType"`
	UploadedBy   *string   `json:"uploadedBy,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}
