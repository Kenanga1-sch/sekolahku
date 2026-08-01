package models

import "time"

type AttendanceSession struct {
	ID           string     `json:"id"`
	Date         string     `json:"date"`
	ClassID      string     `json:"classId"`
	ClassName    string     `json:"className"`
	AcademicYear string     `json:"academicYear"`
	Status       string     `json:"status"`
	OpenedAt     *time.Time `json:"openedAt"`
	ClosedAt     *time.Time `json:"closedAt"`
	CreatedAt    *time.Time `json:"createdAt"`
	UpdatedAt    *time.Time `json:"updatedAt"`
}

type AttendanceRecord struct {
	ID           string     `json:"id"`
	SessionID    string     `json:"sessionId"`
	StudentID    string     `json:"studentId"`
	Status       string     `json:"status"`
	CheckInTime  *time.Time `json:"checkInTime"`
	RecordedBy   string     `json:"recordedBy"`
	RecordMethod string     `json:"recordMethod"`
	Notes        *string    `json:"notes"`
	CreatedAt    *time.Time `json:"createdAt"`
	UpdatedAt    *time.Time `json:"updatedAt"`
	Student      *Student   `json:"student,omitempty"`
}

type AttendanceStats struct {
	TotalStudents int        `json:"totalStudents"`
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

type AttendanceManualRequestV2 struct {
	Date      string `json:"date"`
	ClassName string `json:"className"`
	StudentID string `json:"studentId"`
	Status    string `json:"status"`
}

type AttendanceScanRequest struct {
	QRCode     string  `json:"qrCode"`
	SessionID  *string `json:"sessionId"`
	Status     string  `json:"status"`
	RecordedBy string  `json:"recordedBy"`
}

type ScanResult struct {
	Student interface{} `json:"student,omitempty"`
	Record  interface{} `json:"record,omitempty"`
	Session interface{} `json:"session,omitempty"`
	Message string      `json:"message,omitempty"`
	Success bool        `json:"success,omitempty"`
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

type StudentAttendanceSummary struct {
	AcademicYear string `json:"academicYear"`
	Hadir        int    `json:"hadir"`
	Sakit        int    `json:"sakit"`
	Izin         int    `json:"izin"`
	Alpha        int    `json:"alpha"`
	TotalDays    int    `json:"totalDays"`
}