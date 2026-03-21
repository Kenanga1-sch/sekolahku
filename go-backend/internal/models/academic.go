package models

import "time"

type AcademicYear struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Semester  string     `json:"semester"`
	IsActive  bool       `json:"isActive"`
	StartDate *string    `json:"startDate"`
	EndDate   *string    `json:"endDate"`
	CreatedAt *time.Time `json:"createdAt"`
	UpdatedAt *time.Time `json:"updatedAt"`
}
