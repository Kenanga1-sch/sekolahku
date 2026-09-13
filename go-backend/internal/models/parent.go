package models

import "time"

// ParentStudent relasi akun orang tua ke siswa.
type ParentStudent struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	StudentID string    `json:"studentId"`
	Relation  string    `json:"relation"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ParentChild ringkasan anak untuk beranda orang tua (join students).
type ParentChild struct {
	StudentID   string  `json:"studentId"`
	FullName    string  `json:"fullName"`
	NISN        string  `json:"nisn"`
	ClassID     string  `json:"classId"`
	ClassName   string  `json:"className"`
	Photo       *string `json:"photo"`
	Relation    string  `json:"relation"`
	Balance     int     `json:"balance"`
	ActiveLoans int     `json:"activeLoans"`
}

// ParentRegisterRequest pendaftaran akun orang tua secara mandiri.
type ParentRegisterRequest struct {
	NISN      string `json:"nisn"`
	BirthDate string `json:"birthDate"`
	Name      string `json:"name"`
	Phone     string `json:"phone"`
	Password  string `json:"password"`
	Relation  string `json:"relation"`
}

// LeaveRequest pengajuan izin/sakit dari orang tua.
type LeaveRequest struct {
	ID             string     `json:"id"`
	StudentID      string     `json:"studentId"`
	StudentName    string     `json:"studentName,omitempty"`
	ClassName      string     `json:"className,omitempty"`
	ParentUserID   string     `json:"parentUserId"`
	ParentName     string     `json:"parentName,omitempty"`
	Type           string     `json:"type"` // izin | sakit
	StartDate      string     `json:"startDate"`
	EndDate        string     `json:"endDate"`
	Reason         string     `json:"reason"`
	AttachmentPath *string    `json:"attachmentPath"`
	Status         string     `json:"status"` // pending | approved | rejected
	ReviewedBy     *string    `json:"reviewedBy"`
	ReviewedAt     *time.Time `json:"reviewedAt"`
	ReviewNote     *string    `json:"reviewNote"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

// ParentAccount akun orang tua yang tertaut ke seorang siswa (untuk admin).
type ParentAccount struct {
	UserID   string `json:"userId"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Relation string `json:"relation"`
}

// CreateLeaveRequest payload orang tua.
type CreateLeaveRequest struct {
	StudentID string `json:"studentId"`
	Type      string `json:"type"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Reason    string `json:"reason"`
}

// ParentAttendanceRecord riwayat presensi anak untuk portal orang tua.
type ParentAttendanceRecord struct {
	Date         string `json:"date"`
	Status       string `json:"status"`
	CheckInTime  *int64 `json:"checkInTime"`
	RecordMethod string `json:"recordMethod"`
}
