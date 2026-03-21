package models

import "time"

type SPMBPeriod struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	AcademicYear string     `json:"academicYear"`
	StartDate    *time.Time `json:"startDate"`
	EndDate      *time.Time `json:"endDate"`
	Quota        int        `json:"quota"`
	IsActive     bool       `json:"isActive"`
	CreatedAt    *time.Time `json:"createdAt"`
	UpdatedAt    *time.Time `json:"updatedAt"`
	Registered   int        `json:"registered"`
}

type CreateSPMBPeriodRequest struct {
	Name      string `json:"name"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Quota     interface{}    `json:"quota"` // Can be float or string when sent from JS, bind safely
	IsActive  bool   `json:"isActive"`
}
