package models

import "time"

type AttendanceSession struct {
	ID          string             `json:"id"`
	Date        string             `json:"date"`
	ClassName   string             `json:"className"`
	TeacherName string             `json:"teacherName"`
	Status      string             `json:"status"` // open, closed
	Notes       string             `json:"notes"`
	OpenedAt    *time.Time         `json:"openedAt"`
	ClosedAt    *time.Time         `json:"closedAt"`
	RecordCount int                `json:"recordCount"`
	CreatedAt   *time.Time         `json:"createdAt"`
	UpdatedAt   *time.Time         `json:"updatedAt"`
	Records     []AttendanceRecord `json:"records,omitempty"`
	AllStudents []Student          `json:"allStudents,omitempty"`
}

type AttendanceRecord struct {
	ID           string     `json:"id"`
	SessionID    string     `json:"sessionId"`
	StudentID    string     `json:"studentId"`
	Status       string     `json:"status"` // hadir, sakit, izin, alpha
	CheckInTime  *time.Time `json:"checkInTime"`
	RecordedBy   string     `json:"recordedBy"`
	RecordMethod string     `json:"recordMethod"` // qr_scan, manual
	Notes        *string    `json:"notes"`
	CreatedAt    *time.Time `json:"createdAt"`
	UpdatedAt    *time.Time `json:"updatedAt"`
	Student      *Student   `json:"student,omitempty"`
}

type AttendanceStats struct {
	TotalStudents int        `json:"totalStudents"`
	OpenSessions  int        `json:"openSessions"`
	Stats         DailyStats `json:"stats"`
}

type DailyStats struct {
	Hadir           int     `json:"hadir"`
	Sakit           int     `json:"sakit"`
	Izin            int     `json:"izin"`
	Alpha           int     `json:"alpha"`
	BelumAbsen      int     `json:"belumAbsen"`
	PersenKehadiran float64 `json:"persenKehadiran"`
}

type CreateAttendanceSessionRequest struct {
	ClassName   string `json:"className"`
	TeacherName string `json:"teacherName"`
	Notes       string `json:"notes"`
}

type AttendanceScanRequest struct {
	QRCode     string  `json:"qrCode"`
	SessionID  *string `json:"sessionId"`
	Status     string  `json:"status"`
	RecordedBy string  `json:"recordedBy"`
}

type AttendanceManualRequest struct {
	SessionID string `json:"sessionId"`
	StudentID string `json:"studentId"`
	Status    string `json:"status"`
}

type AttendanceReportRecord struct {
	ID           string  `json:"id"`
	Date         string  `json:"date"`
	ClassName    string  `json:"className"`
	StudentID    string  `json:"studentId"`
	StudentName  string  `json:"studentName"`
	NIS          *string `json:"nis"`
	NISN         *string `json:"nisn"`
	Status       string  `json:"status"`
	CheckInTime  *string `json:"checkInTime"`
	RecordMethod string  `json:"recordMethod"`
}

type AttendanceReportSummary struct {
	Total int `json:"total"`
	Hadir int `json:"hadir"`
	Sakit int `json:"sakit"`
	Izin  int `json:"izin"`
	Alpha int `json:"alpha"`
}

type AttendanceReportResponse struct {
	Records []AttendanceReportRecord `json:"records"`
	Summary AttendanceReportSummary  `json:"summary"`
}
