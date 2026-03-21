package models

import "time"

type SchoolSetting struct {
	ID                  string     `json:"id"`
	CurrentAcademicYear *string    `json:"currentAcademicYear"`
	// Additional fields can be added here if needed
	CreatedAt           *time.Time `json:"createdAt"`
	UpdatedAt           *time.Time `json:"updatedAt"`
}
