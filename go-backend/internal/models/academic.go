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

type AcademicClass struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Grade        int     `json:"grade"`
	AcademicYear string  `json:"academicYear"`
	TeacherName  *string `json:"teacherName"`
	Capacity     int     `json:"capacity"`
	IsActive     bool    `json:"isActive"`
}

type Subject struct {
	ID          string     `json:"id"`
	Code        string     `json:"code"`
	Name        string     `json:"name"`
	Category    string     `json:"category"`
	Description string     `json:"description"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

type PromotionRequest struct {
	StudentIds    []string `json:"studentIds"`
	TargetClassId *string  `json:"targetClassId"`
	ActionType    string   `json:"actionType"` // "promotion" or "graduation"
}

type PromotionResponse struct {
	Success bool `json:"success"`
	Count   int  `json:"count"`
}
