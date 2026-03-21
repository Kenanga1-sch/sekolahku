package models

import "time"

type Student struct {
	ID        string     `json:"id"`
	NIK       *string    `json:"nik"`
	NISN      *string    `json:"nisn"`
	NIS       *string    `json:"nis"`
	FullName  string     `json:"fullName"`
	Gender    *string    `json:"gender"`
	ClassName *string    `json:"className"`
	IsActive  bool       `json:"isActive"`
	Status    string     `json:"status"`
	CreatedAt *time.Time `json:"createdAt"`
}

type StudentByClass struct {
	ClassName *string `json:"className"`
	Count     int     `json:"count"`
}

type StudentPagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

type StudentSummary struct {
	Total   int              `json:"total"`
	Active  int              `json:"active"`
	ByClass []StudentByClass `json:"byClass"`
}

type StudentResponse struct {
	Data       []Student         `json:"data"`
	Pagination StudentPagination `json:"pagination"`
	Summary    StudentSummary    `json:"summary"`
}
