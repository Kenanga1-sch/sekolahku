package models

import "time"

// Attendance
type AttendanceSession struct {
	ID          string     `json:"id"`
	Date        string     `json:"date"`
	ClassID     *string    `json:"classId"`
	ClassName   string     `json:"className"`
	TeacherID   *string    `json:"teacherId"`
	TeacherName *string    `json:"teacherName"`
	Status      string     `json:"status"`
	OpenedAt    *time.Time `json:"openedAt"`
	ClosedAt    *time.Time `json:"closedAt"`
}

type AttendanceRecord struct {
	ID           string     `json:"id"`
	SessionID    string     `json:"sessionId"`
	StudentID    string     `json:"studentId"`
	Status       string     `json:"status"`
	CheckInTime  *time.Time `json:"checkInTime"`
	RecordedBy   *string    `json:"recordedBy"`
	RecordMethod string     `json:"recordMethod"`
}

type AttendanceScanRequest struct {
	QRCode     string  `json:"qrCode"`
	SessionID  *string `json:"sessionId"` // optional
	Status     string  `json:"status"`    // default "hadir"
	RecordedBy *string `json:"recordedBy"`
}

// Curriculum / Grades
type StudentGrade struct {
	StudentID string  `json:"studentId"`
	Score     int     `json:"score"`
	Type      string  `json:"type"`
	Notes     *string `json:"notes"`
}

type BulkGradeRequest struct {
	TpID   string         `json:"tpId"`
	Grades []StudentGrade `json:"grades"`
}
