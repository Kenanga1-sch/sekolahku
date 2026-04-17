package models

import "time"

type AuditLog struct {
	ID        string     `json:"id"`
	Action    string     `json:"action"`
	Resource  string     `json:"resource"`
	Details   *string    `json:"details"`
	UserID    *string    `json:"user_id"`
	UserName  *string    `json:"user_name"`
	UserEmail *string    `json:"user_email"`
	IPAddress *string    `json:"ip_address"`
	UserAgent *string    `json:"user_agent"`
	CreatedAt *time.Time `json:"created"`
}


type AuditLogResponse struct {
	Items      []AuditLog `json:"items"`
	TotalItems int        `json:"totalItems"`
	Page       int        `json:"page"`
	Limit      int        `json:"limit"`
	TotalPages int        `json:"totalPages"`
}
