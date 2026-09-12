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
	// Wali kelas sebagai relasi ke users.id — source of truth scoping
	// Presensi & Tabungan (guru hanya melihat kelasnya sendiri).
	WaliUserID   *string `json:"waliUserId"`
	WaliUserName *string `json:"waliUserName"`
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
}

type PromotionResponse struct {
	Success bool `json:"success"`
	Count   int  `json:"count"`
}
