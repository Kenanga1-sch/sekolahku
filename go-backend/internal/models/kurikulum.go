package models

import "time"

type Kurikulum struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	IsActive    bool       `json:"isActive"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

type CreateKurikulumRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsActive    *bool   `json:"isActive"`
}

type UpdateKurikulumRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	IsActive    *bool   `json:"isActive"`
}
