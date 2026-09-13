package models

import "time"

// PushSubscription satu perangkat/browser yang berlangganan notifikasi.
type PushSubscription struct {
	ID         string     `json:"id"`
	UserID     string     `json:"userId"`
	Endpoint   string     `json:"endpoint"`
	P256dh     string     `json:"p256dh"`
	Auth       string     `json:"auth"`
	UserAgent  string     `json:"userAgent"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty"`
}

// PushSubscribeRequest payload dari browser (PushSubscription.toJSON()).
type PushSubscribeRequest struct {
	Endpoint  string `json:"endpoint"`
	P256dh    string `json:"p256dh"`
	Auth      string `json:"auth"`
	UserAgent string `json:"userAgent"`
}

// PushUnsubscribeRequest minimal butuh endpoint untuk dihapus.
type PushUnsubscribeRequest struct {
	Endpoint string `json:"endpoint"`
}

// PushPayload isi notifikasi yang dikirim ke service worker.
type PushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url,omitempty"`
	Tag   string `json:"tag,omitempty"`
	Icon  string `json:"icon,omitempty"`
}
