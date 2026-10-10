package models

import "time"

// ===== Modul Komputer Belajar Perpustakaan =====
// Siswa membaca buku → menulis ringkasan/kesimpulan/pertanyaan → guru verifikasi
// → siswa dapat jatah menit memakai komputer. Bukan billing uang, hanya kuota waktu.

// ComputerStation adalah satu unit komputer yang bisa dibooking.
type ComputerStation struct {
	ID         string    `json:"id"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Location   string    `json:"location"`
	SortOrder  int       `json:"sortOrder"`
	Status     string    `json:"status"` // active|maintenance|inactive
	LastSeenAt time.Time `json:"lastSeenAt"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// ComputerQuotaPolicy = jatah menit default per kelas. ClassName "" = default.
type ComputerQuotaPolicy struct {
	ClassName string    `json:"className"`
	Minutes   int       `json:"minutes"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ComputerTimeQuota = jatah menit per siswa (bisa dipecah lintas sesi).
type ComputerTimeQuota struct {
	StudentID    string    `json:"studentId"`
	StudentName  string    `json:"studentName,omitempty"`
	ClassName    string    `json:"className,omitempty"`
	TotalMinutes int       `json:"totalMinutes"`
	UsedMinutes  int       `json:"usedMinutes"`
	Remaining    int       `json:"remainingMinutes"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// ReadingReport = bukti syarat membaca. Status: pending|approved|rejected.
type ReadingReport struct {
	ID           string     `json:"id"`
	StudentID    string     `json:"studentId"`
	StudentName  string     `json:"studentName"`
	ClassName    string     `json:"className"`
	CatalogID    *string    `json:"catalogId,omitempty"`
	BookTitle    string     `json:"bookTitle"`
	BookAuthor   string     `json:"bookAuthor"`
	Summary      string     `json:"summary"`
	Conclusion   string     `json:"conclusion"`
	Question     string     `json:"question"`
	Status       string     `json:"status"`
	ReviewNotes  string     `json:"reviewNotes"`
	ReviewedBy   *string    `json:"reviewedBy,omitempty"`
	ReviewedAt   *time.Time `json:"reviewedAt,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

// ComputerBooking = booking penggunaan komputer oleh siswa (dibuat guru/admin).
type ComputerBooking struct {
	ID             string    `json:"id"`
	StationID      string    `json:"stationId"`
	StationName    string    `json:"stationName,omitempty"`
	StudentID      string    `json:"studentId"`
	StudentName    string    `json:"studentName"`
	ClassName      string    `json:"className"`
	ReportID       *string   `json:"reportId,omitempty"`
	SlotStart      time.Time `json:"slotStart"`
	SlotEnd        time.Time `json:"slotEnd"`
	PlannedMinutes int       `json:"plannedMinutes"`
	Status         string    `json:"status"` // booked|active|completed|cancelled|expired|no_show
	Notes          string    `json:"notes"`
	CreatedBy      *string   `json:"createdBy,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// ComputerSession = sesi nyata pemakaian komputer (timer server-authoritative).
type ComputerSession struct {
	ID          string     `json:"id"`
	BookingID   *string    `json:"bookingId,omitempty"`
	StationID   string     `json:"stationId"`
	StationName string     `json:"stationName,omitempty"`
	StudentID   string     `json:"studentId"`
	StudentName string     `json:"studentName"`
	StartedAt   time.Time  `json:"startedAt"`
	DeadlineAt  time.Time  `json:"deadlineAt"`
	EndedAt     *time.Time `json:"endedAt,omitempty"`
	MinutesUsed int        `json:"minutesUsed"`
	EndReason   string     `json:"endReason"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

// RemainingMinutes menghitung sisa menit sebelum deadline pada waktu tertentu.
func (s *ComputerSession) RemainingMinutes(now time.Time) int {
	if s.DeadlineAt.IsZero() {
		return 0
	}
	rem := int(s.DeadlineAt.Sub(now).Minutes())
	if rem < 0 {
		return 0
	}
	return rem
}

// ==== Request DTOs ====

type CreateReadingReportRequest struct {
	CatalogID  string `json:"catalogId"`
	BookTitle  string `json:"bookTitle"`
	BookAuthor string `json:"bookAuthor"`
	Summary    string `json:"summary"`
	Conclusion string `json:"conclusion"`
	Question   string `json:"question"`
}

type ReviewReadingReportRequest struct {
	Approve bool   `json:"approve"`
	Notes   string `json:"notes"`
}

type CreateComputerBookingRequest struct {
	StationID    string `json:"stationId"`
	StudentID    string `json:"studentId"`
	ReportID     string `json:"reportId"`
	SlotStart    string `json:"slotStart"` // RFC3339 atau epoch-ms string
	PlannedMinutes int  `json:"plannedMinutes"`
	Notes        string `json:"notes"`
}

type CreateComputerStationRequest struct {
	Code      string `json:"code"`
	Name      string `json:"name"`
	Location  string `json:"location"`
	SortOrder int    `json:"sortOrder"`
	Status    string `json:"status"`
}

type SetQuotaPolicyRequest struct {
	ClassName string `json:"className"`
	Minutes   int    `json:"minutes"`
}

type SetStudentQuotaRequest struct {
	StudentID    string `json:"studentId"`
	TotalMinutes int    `json:"totalMinutes"`
}
