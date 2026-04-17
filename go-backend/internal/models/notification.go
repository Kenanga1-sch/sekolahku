package models

type Notification struct {
	ID        string `json:"id"`
	UserID    *string `json:"userId"`
	Type      string `json:"type"` // info, warning, success, error
	Category  string `json:"category"` // system, account, finance, etc.
	Title     string `json:"title"`
	Message   string `json:"message"`
	TargetURL *string `json:"targetUrl"`
	IsRead    bool   `json:"isRead"`
	Metadata  *string `json:"metadata"` // JSON string
	CreatedAt int64  `json:"createdAt"`
}

type NotificationStats struct {
	UnreadCount int `json:"unreadCount"`
}
