package models

import "time"

type User struct {
	ID            string     `json:"id"`
	Name          *string    `json:"name"`
	Email         string     `json:"email"`
	EmailVerified *time.Time `json:"emailVerified"`
	Image         *string    `json:"image"`
	Username      *string    `json:"username"`
	PasswordHash  *string    `json:"-"` // Omit from JSON response
	Role          string     `json:"role"`
	FullName      *string    `json:"fullName"`
	Phone         *string    `json:"phone"`
	IsActive      bool       `json:"isActive"`
	CreatedAt     *time.Time `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt"`
}
