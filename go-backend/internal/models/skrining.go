package models

import "encoding/json"

// ScreeningGame adalah katalog game skrining (referensi, tidak di-CRUD per sesi).
type ScreeningGame struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Domain      string `json:"domain"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
	Version     string `json:"version"`
	OrderNumber int    `json:"orderNumber"`
	IsActive    bool   `json:"isActive"`
}

// DOMAIN_LABELS memetakan kode domain ke label tampilan (measure, don't label).
var DomainLabels = map[string]string{
	"perhatian":       "Perhatian",
	"inhibitory":      "Pengendalian Respons",
	"working_memory":  "Ingatan Jangka Pendek",
	"literasi":        "Literasi Dasar",
	"numerasi":        "Numerasi Dasar",
	"bahasa":          "Bahasa & Komunikasi",
	"visual_motorik":  "Visual & Motorik",
	"sosial_emosional": "Sosial-Emosional",
}

// ScreeningSession adalah sesi skrining yang dibuat guru (1 game per sesi).
type ScreeningSession struct {
	ID             string `json:"id"`
	GameID         string `json:"gameId"`
	GameName       string `json:"gameName,omitempty"`
	GameIcon       string `json:"gameIcon,omitempty"`
	Domain         string `json:"domain,omitempty"`
	ClassID        string `json:"classId"`
	ClassName      string `json:"className,omitempty"`
	TeacherUserID  string `json:"teacherUserId"`
	TeacherName    string `json:"teacherName,omitempty"`
	AcademicYear   string `json:"academicYear,omitempty"`
	Title          string `json:"title,omitempty"`
	Status         string `json:"status"`
	StartedAt      int64  `json:"startedAt,omitempty"`
	FinishedAt     int64  `json:"finishedAt,omitempty"`
	Notes          string `json:"notes,omitempty"`
	CreatedAt      int64  `json:"createdAt"`
	UpdatedAt      int64  `json:"updatedAt,omitempty"`
	TotalStudents  int    `json:"totalStudents,omitempty"`
	CompletedCount int    `json:"completedCount,omitempty"`
}

// SessionRosterItem adalah baris roster siswa + status pengerjaan terakhirnya.
type SessionRosterItem struct {
	StudentID    string `json:"studentId"`
	StudentName  string `json:"studentName"`
	AttemptID    string `json:"attemptId,omitempty"`
	AttemptNo    int    `json:"attemptNo,omitempty"`
	AttemptStatus string `json:"attemptStatus,omitempty"`
	Accuracy     *float64 `json:"accuracy,omitempty"`
	LevelReached *int    `json:"levelReached,omitempty"`
	HasObservation bool  `json:"hasObservation,omitempty"`
}

// ScreeningAttempt adalah satu kali pengerjaan oleh siswa.
type ScreeningAttempt struct {
	ID            string `json:"id"`
	SessionID     string `json:"sessionId"`
	StudentID     string `json:"studentId"`
	StudentName   string `json:"studentName,omitempty"`
	GameID        string `json:"gameId"`
	GameName      string `json:"gameName,omitempty"`
	Domain        string `json:"domain,omitempty"`
	GameVersion   string `json:"gameVersion,omitempty"`
	AttemptNumber int    `json:"attemptNumber"`
	Status        string `json:"status"`
	StartedAt     int64  `json:"startedAt,omitempty"`
	CompletedAt   int64  `json:"completedAt,omitempty"`
	DurationMs    int64  `json:"durationMs,omitempty"`
	DeviceType    string `json:"deviceType,omitempty"`
	Browser       string `json:"browser,omitempty"`
	ScreenWidth   int    `json:"screenWidth,omitempty"`
	ScreenHeight  int    `json:"screenHeight,omitempty"`
	InputType     string `json:"inputType,omitempty"`
	CreatedAt     int64  `json:"createdAt"`
}

// ScreeningTrial adalah data mentah satu percobaan (§22).
type ScreeningTrial struct {
	ID              string `json:"id"`
	AttemptID       string `json:"attemptId"`
	TrialNumber     int    `json:"trialNumber"`
	Level           int    `json:"level,omitempty"`
	Stimulus        string `json:"stimulus,omitempty"`
	Response        string `json:"response,omitempty"`
	IsCorrect       *bool  `json:"isCorrect,omitempty"`
	ReactionTimeMs  int64  `json:"reactionTimeMs,omitempty"`
	RespondedAt     int64  `json:"respondedAt,omitempty"`
}

// ScreeningMetrics adalah metrik terhitung per dimensi. Disimpan sebagai JSON
// di screening_results.metrics, tapi tetap bisa dihitung ulang dari trial
// mentah tanpa mengulang tes.
type ScreeningMetrics struct {
	TotalTrials   int     `json:"totalTrials"`
	Correct       int     `json:"correct"`
	Incorrect     int     `json:"incorrect"`
	Missed        int     `json:"missed"`
	RTAvg         float64 `json:"rtAvg"`
	RTMedian      float64 `json:"rtMedian"`
	RTMin         int64   `json:"rtMin"`
	RTMax         int64   `json:"rtMax"`
	RTVariability float64 `json:"rtVariability"`
	Accuracy      float64 `json:"accuracy"`
	LevelReached  int     `json:"levelReached"`
	// ErrorBreakpoint: level kesulitan pertama tempat kesalahan mulai
	// meningkat (analisis TikTok...Numerasi). Hanya untuk game bertingkat.
	ErrorBreakpoint *int `json:"errorBreakpoint,omitempty"`
}

func (m ScreeningMetrics) JSON() string {
	b, _ := json.Marshal(m)
	return string(b)
}

// ScreeningResult adalah hasil terhitung satu attempt.
type ScreeningResult struct {
	ID           string            `json:"id"`
	AttemptID    string            `json:"attemptId"`
	SessionID    string            `json:"sessionId"`
	StudentID    string            `json:"studentId"`
	GameID       string            `json:"gameId"`
	Domain       string            `json:"domain"`
	Metrics      ScreeningMetrics  `json:"metrics"`
	LevelReached int               `json:"levelReached,omitempty"`
	Accuracy     float64           `json:"accuracy"`
	ComputedAt   int64             `json:"computedAt"`
}

// TeacherObservation adalah hasil pengamatan guru (§26).
type TeacherObservation struct {
	ID         string `json:"id"`
	SessionID  string `json:"sessionId"`
	StudentID  string `json:"studentId"`
	Checklist  string `json:"checklist,omitempty"`
	Notes      string `json:"notes,omitempty"`
	CreatedBy  string `json:"createdBy"`
	CreatedAt  int64  `json:"createdAt"`
	UpdatedAt  int64  `json:"updatedAt,omitempty"`
}

// ParentObservation adalah pengamatan orang tua di rumah (§24).
// answers = JSON {domain: [item tercentang]}; struktur sama dengan
// observasi guru namun konteks rumah.
type ParentObservation struct {
	ID           string `json:"id"`
	StudentID    string `json:"studentId"`
	ParentUserID string `json:"parentUserId"`
	AcademicYear string `json:"academicYear,omitempty"`
	Answers      string `json:"answers,omitempty"`
	Notes        string `json:"notes,omitempty"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt,omitempty"`
}

// ScreeningRecommendation adalah rekomendasi tindak lanjut (§25).
// Dibuat guru/staff; bisa dibagikan ke orang tua (shared_to_parent).
type ScreeningRecommendation struct {
	ID             string `json:"id"`
	StudentID      string `json:"studentId"`
	SessionID      string `json:"sessionId,omitempty"`
	Domain         string `json:"domain,omitempty"`
	Recommendation string `json:"recommendation"`
	FollowUpType   string `json:"followUpType,omitempty"`
	SharedToParent bool   `json:"sharedToParent"`
	CreatedBy      string `json:"createdBy"`
	CreatedAt      int64  `json:"createdAt"`
	UpdatedAt      int64  `json:"updatedAt,omitempty"`
}

// ══════════════════════════════════════════════════════════
// Request DTOs
// ══════════════════════════════════════════════════════════

type CreateScreeningSessionRequest struct {
	GameID string `json:"gameId"`
	Title  string `json:"title"`
	Notes  string `json:"notes"`
}

type TrialInput struct {
	TrialNumber    int    `json:"trialNumber"`
	Level          int    `json:"level"`
	Stimulus       string `json:"stimulus"`
	Response       string `json:"response"`
	IsCorrect      *bool  `json:"isCorrect"`
	ReactionTimeMs int64  `json:"reactionTimeMs"`
}

type SubmitAttemptRequest struct {
	Trials      []TrialInput `json:"trials"`
	DeviceType  string       `json:"deviceType"`
	Browser     string       `json:"browser"`
	ScreenWidth int          `json:"screenWidth"`
	ScreenHeight int         `json:"screenHeight"`
	InputType   string       `json:"inputType"`
}

type SaveObservationRequest struct {
	StudentID string   `json:"studentId"`
	Checklist []string `json:"checklist"`
	Notes     string   `json:"notes"`
}

// SaveParentObservationRequest: kuesioner pengamatan orang tua (§24).
type SaveParentObservationRequest struct {
	StudentID string              `json:"studentId"`
	Answers   map[string][]string `json:"answers"`
	Notes     string              `json:"notes"`
}

// ScreeningDashboard adalah statistik kelas untuk guru (§29).
type ScreeningDashboard struct {
	ClassID         string                  `json:"classId,omitempty"`
	ClassName       string                  `json:"className,omitempty"`
	AcademicYear    string                  `json:"academicYear,omitempty"`
	TotalStudents   int                     `json:"totalStudents"`
	ScreenedCount   int                     `json:"screenedCount"`
	DomainStats     []ScreeningDomainStat   `json:"domainStats"`
	RecentSessions  []ScreeningSession      `json:"recentSessions"`
}

type ScreeningDomainStat struct {
	Domain      string  `json:"domain"`
	DomainLabel string  `json:"domainLabel"`
	Attempts    int     `json:"attempts"`
	AvgAccuracy float64 `json:"avgAccuracy"`
	AvgRTMs     float64 `json:"avgRtMs"`
}
