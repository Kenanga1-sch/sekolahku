package models

import "time"

// UserIdentity tautan akun lokal ke identitas penyedia OAuth (mis. Google).
// Password tidak disimpan di sini: identitas eksternal hanya membuktikan
// kepemilikan email, sedangkan hak akses tetap dari kolom users.role.
type UserIdentity struct {
	ID             string     `json:"id"`
	UserID         string     `json:"userId"`
	Provider       string     `json:"provider"`
	ProviderUserID string     `json:"providerUserId"`
	Email          *string    `json:"email"`
	EmailVerified  bool       `json:"emailVerified"`
	CreatedAt      *time.Time `json:"createdAt"`
	UpdatedAt      *time.Time `json:"updatedAt"`
}
