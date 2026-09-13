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
// isi laporan pelapor.
type ContactStatusView struct {
	Category  string    `json:"category"`
	Status    string    `json:"status"`
	Ticket    string    `json:"ticket"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
