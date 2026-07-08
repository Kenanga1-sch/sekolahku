package models

import "time"

// MutasiRequest represents an incoming student transfer request
type MutasiRequest struct {
	ID                   string     `json:"id"`
	RegistrationNumber   string     `json:"registrationNumber"`
	StudentName          string     `json:"studentName"`
	NISN                 string     `json:"nisn"`
	Gender               string     `json:"gender"` // L or P
	OriginSchool         string     `json:"originSchool"`
	OriginSchoolAddress  *string    `json:"originSchoolAddress"`
	TargetGrade          int        `json:"targetGrade"`
	TargetClassID        *string    `json:"targetClassId"`
	ParentName           string     `json:"parentName"`
	WhatsappNumber       string     `json:"whatsappNumber"`
	StatusApproval       string     `json:"statusApproval"` // pending, verified, rejected, principal_approved
	StatusDelivery       string     `json:"statusDelivery"` // unsent, sent
	CreatedAt            *time.Time `json:"createdAt"`
	UpdatedAt            *time.Time `json:"updatedAt"`
}

// MutasiOutRequest represents an outgoing student transfer request
type MutasiOutRequest struct {
	ID                string     `json:"id"`
	StudentID         string     `json:"studentId"`
	StudentName       string     `json:"studentName"` // Joined from students
	NISN              string     `json:"nisn"`        // Joined from students
	ClassName         string     `json:"className"`   // Joined from students
	DestinationSchool string     `json:"destinationSchool"`
	Reason            string     `json:"reason"`
	ReasonDetail      *string    `json:"reasonDetail"`
	Status            string     `json:"status"` // draft, processed, completed
	DownloadedAt      *time.Time `json:"downloadedAt"`
	ProcessedAt       *time.Time `json:"processedAt"`
	CompletedAt       *time.Time `json:"completedAt"`
	CreatedAt         *time.Time `json:"createdAt"`
	UpdatedAt         *time.Time `json:"updatedAt"`
}

// MutasiLog represents a finalised mutation entry in the Buku Mutasi
type MutasiLog struct {
	ID                  string     `json:"id"`
	MutasiType          string     `json:"mutasiType"` // "masuk" or "keluar"
	StudentID           *string    `json:"studentId"`
	StudentName         string     `json:"studentName"`
	NISN                string     `json:"nisn"`
	Gender              *string    `json:"gender"`
	OriginOrDestination string     `json:"originOrDestination"`
	MutationDate        *time.Time `json:"mutationDate"`
	Reason              *string    `json:"reason"`
	CreatedAt           *time.Time `json:"createdAt"`
}


// ClassStats represents enrollment statistics for a specific class
type ClassStats struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Grade        int    `json:"grade"`
	StudentCount int    `json:"studentCount"`
	Capacity     int    `json:"capacity"`
}

// ClassStatsResponse represents the response for the classes stats endpoint
type ClassStatsResponse struct {
	Success bool         `json:"success"`
	Data    []ClassStats `json:"data"`
}
