package models

import "time"

type FAQ struct {
	ID        string     `json:"id"`
	Category  string     `json:"category"`
	Question  string     `json:"question"`
	Answer    string     `json:"answer"`
	OrderRank int        `json:"orderRank"`
	IsActive  bool       `json:"isActive"`
	CreatedAt *time.Time `json:"createdAt"`
	UpdatedAt *time.Time `json:"updatedAt"`
}

type CreateFAQRequest struct {
	Category  string `json:"category"`
	Question  string `json:"question"`
	Answer    string `json:"answer"`
	OrderRank int    `json:"orderRank"`
}

type UpdateFAQRequest struct {
	Category  *string `json:"category"`
	Question  *string `json:"question"`
	Answer    *string `json:"answer"`
	OrderRank *int    `json:"orderRank"`
	IsActive  *bool   `json:"isActive"`
}
