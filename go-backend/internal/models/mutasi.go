package models

import "time"

// MutasiRequest represents an incoming student transfer request
type MutasiRequest struct {
	ID                  string     `json:"id"`
	RegistrationNumber  string     `json:"registrationNumber"`
	StudentName         string     `json:"studentName"`
	NISN                string     `json:"nisn"`
	Gender              string     `json:"gender"` // L or P
	OriginSchool        string     `json:"originSchool"`
	OriginSchoolAddress *string    `json:"originSchoolAddress"`
	OriginNis           *string    `json:"originNis"`
	OriginClass         *string    `json:"originClass"`
	TargetGrade         int        `json:"targetGrade"`
	TargetClassID       *string    `json:"targetClassId"`
	ParentName          string     `json:"parentName"`
	WhatsappNumber      string     `json:"whatsappNumber"`
	ApprovalNo          *string    `json:"approvalNo"`
	ApprovalDate        *string    `json:"approvalDate"`
	StatusApproval      string     `json:"statusApproval"` // pending, verified, rejected, principal_approved
	StatusDelivery      string     `json:"statusDelivery"` // unsent, sent
	CreatedAt           *time.Time `json:"createdAt"`
	UpdatedAt           *time.Time `json:"updatedAt"`
}

// MutasiOutRequest represents an outgoing student transfer request
type MutasiOutRequest struct {
	ID                string     `json:"id"`
	StudentID         string     `json:"studentId"`
	StudentName       string     `json:"studentName"` // Joined from students
	NISN              string     `json:"nisn"`        // Joined from students
	ClassName         string     `json:"className"`   // Joined from students
	DestinationSchool string     `json:"destinationSchool"`
	DestinationClass  *string    `json:"destinationClass"`
	LetterNo          *string    `json:"letterNo"`
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
	NIS                 *string    `json:"nis"`
	Gender              *string    `json:"gender"`
	ClassName           *string    `json:"className"`
	ClassGrade          *int       `json:"classGrade"`
	OriginOrDestination string     `json:"originOrDestination"`
	OriginNis           *string    `json:"originNis"`
	OriginClass         *string    `json:"originClass"`
	ApprovalDate        *string    `json:"approvalDate"`
	ApprovalNo          *string    `json:"approvalNo"`
	LetterNo            *string    `json:"letterNo"`
	DestinationClass    *string    `json:"destinationClass"`
	MutationDate        *time.Time `json:"mutationDate"`
	Reason              *string    `json:"reason"`
	CreatedAt           *time.Time `json:"createdAt"`
}

// MutasiRekapItem represents per-grade rekap data for Buku Mutasi
type MutasiRekapItem struct {
	Grade   int `json:"grade"`
	AwalL   int `json:"awalL"`
	AwalP   int `json:"awalP"`
	MasukL  int `json:"masukL"`
	MasukP  int `json:"masukP"`
	KeluarL int `json:"keluarL"`
	KeluarP int `json:"keluarP"`
	AkhirL  int `json:"akhirL"`
	AkhirP  int `json:"akhirP"`
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
