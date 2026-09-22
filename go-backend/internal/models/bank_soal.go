package models

import "time"

// ── Bab / Chapter ──

type Bab struct {
	ID           string     `json:"id"`
	SubjectID    string     `json:"subjectId"`
	ClassID      *string    `json:"classId"`
	KurikulumID  *string    `json:"kurikulumId"`
	Semester     *string    `json:"semester"`
	Title        string     `json:"title"`
	Description  *string    `json:"description"`
	OrderNumber  int        `json:"orderNumber"`
	CreatedAt    *time.Time `json:"createdAt"`
	UpdatedAt    *time.Time `json:"updatedAt"`
	DeletedAt    *time.Time `json:"deletedAt,omitempty"`

	// Joined fields (optional, populated on read)
	SubjectName   *string `json:"subjectName,omitempty"`
	ClassName     *string `json:"className,omitempty"`
	KurikulumName *string `json:"kurikulumName,omitempty"`
}

// ── Question Bank ──

type QuestionBank struct {
	ID          string     `json:"id"`
	SubjectID   string     `json:"subjectId"`
	ClassID     *string    `json:"classId"`
	BabID       *string    `json:"babId"`
	KurikulumID *string    `json:"kurikulumId"`
	Semester    *string    `json:"semester"`
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	CreatedBy   string     `json:"createdBy"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
	DeletedAt   *time.Time `json:"deletedAt,omitempty"`

	// Joined fields
	SubjectName   *string `json:"subjectName,omitempty"`
	ClassName     *string `json:"className,omitempty"`
	BabTitle      *string `json:"babTitle,omitempty"`
	CreatorName   *string `json:"creatorName,omitempty"`
	KurikulumName *string `json:"kurikulumName,omitempty"`
	QuestionCount int     `json:"questionCount,omitempty"`
}

// ── Question ──

type QuestionOption struct {
	ID        string  `json:"id"`
	Text      string  `json:"text"`
	IsCorrect bool    `json:"isCorrect"`
	MediaURL  *string `json:"mediaUrl,omitempty"`
}

type Question struct {
	ID            string     `json:"id"`
	BankID        string     `json:"bankId"`
	Type          string     `json:"type"` // pg_single, pg_multi, true_false, fill_blank, matching, pair_match, essay
	Content       string     `json:"content"`
	MediaURL      *string    `json:"mediaUrl,omitempty"`
	MediaType     *string    `json:"mediaType,omitempty"` // image, video, audio
	Options       *string    `json:"options,omitempty"`   // JSON string of []QuestionOption
	CorrectAnswer *string    `json:"correctAnswer,omitempty"`
	Explanation   *string    `json:"explanation,omitempty"`
	Points        int        `json:"points"`
	OrderNumber   int        `json:"orderNumber"`
	Difficulty    string     `json:"difficulty"` // easy, medium, hard
	BloomLevel    *string    `json:"bloomLevel,omitempty"` // remember..create
	Tags          []string   `json:"tags,omitempty"`
	CreatedBy     string     `json:"createdBy"`
	CreatedAt     *time.Time `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt"`
	DeletedAt     *time.Time `json:"deletedAt,omitempty"`
}

// ── Question Set (Paket Soal) ──

type QuestionSet struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	BankID           string     `json:"bankId"`
	AcademicYear     *string    `json:"academicYear,omitempty"`
	Mode             string     `json:"mode"`             // latihan | ujian
	ShuffleQuestions  bool       `json:"shuffleQuestions"`
	ShuffleOptions   bool       `json:"shuffleOptions"`
	TimerMinutes     *int       `json:"timerMinutes,omitempty"`
	MaxAttempts      *int       `json:"maxAttempts,omitempty"`
	AvailableFrom    *time.Time `json:"availableFrom,omitempty"`
	AvailableUntil   *time.Time `json:"availableUntil,omitempty"`
	ResultVisible    bool       `json:"resultVisible"`
	CreatedBy        string     `json:"createdBy"`
	CreatedAt        *time.Time `json:"createdAt"`
	UpdatedAt        *time.Time `json:"updatedAt"`
	DeletedAt        *time.Time `json:"deletedAt,omitempty"`

	// Joined fields
	BankTitle    *string `json:"bankTitle,omitempty"`
	ItemCount    int     `json:"itemCount,omitempty"`
	AssignedClasses []ExamAssignment `json:"assignedClasses,omitempty"`
}

// ── Exam Assignment (penugasan paket ujian ke kelas) ──

type ExamAssignment struct {
	ID           string     `json:"id"`
	SetID        string     `json:"setId"`
	ClassID      string     `json:"classId"`
	AssignedBy   string     `json:"assignedBy"`
	CreatedAt    *time.Time `json:"createdAt,omitempty"`

	// Joined fields
	ClassName *string `json:"className,omitempty"`
}

// ── Question Set Item ──

type QuestionSetItem struct {
	ID             string `json:"id"`
	SetID          string `json:"setId"`
	QuestionID     string `json:"questionId"`
	OrderNumber    int    `json:"orderNumber"`
	PointsOverride *int   `json:"pointsOverride,omitempty"`

	// Populated on read
	Question *Question `json:"question,omitempty"`
}

// ── Student Practice ──

type StudentPractice struct {
	ID            string     `json:"id"`
	StudentID     string     `json:"studentId"`
	SetID         string     `json:"setId"`
	StartedAt     *time.Time `json:"startedAt"`
	FinishedAt    *time.Time `json:"finishedAt,omitempty"`
	TotalScore    float64    `json:"totalScore"`
	MaxScore      float64    `json:"maxScore"`
	IsCompleted   bool       `json:"isCompleted"`
	AttemptNumber int        `json:"attemptNumber"`
	CreatedAt     *time.Time `json:"createdAt"`

	// Joined fields
	SetName    *string `json:"setName,omitempty"`
	StudentName *string `json:"studentName,omitempty"`

	// Flag dari question_set terkait
	ShuffleQuestions *bool `json:"shuffleQuestions,omitempty"`
	ShuffleOptions   *bool `json:"shuffleOptions,omitempty"`
	TimerMinutes     *int  `json:"timerMinutes,omitempty"`

	// Mode ujian
	Mode         *string    `json:"mode,omitempty"`
	DeadlineAt   *time.Time `json:"deadlineAt,omitempty"`
	QuestionOrder string    `json:"questionOrder,omitempty"` // JSON array question_id
}

// ── Student Practice Answer ──

type StudentPracticeAnswer struct {
	ID           string     `json:"id"`
	PracticeID   string     `json:"practiceId"`
	QuestionID   string     `json:"questionId"`
	Answer       *string    `json:"answer,omitempty"`
	IsCorrect    *bool      `json:"isCorrect,omitempty"`
	PointsEarned float64    `json:"pointsEarned"`
	AnsweredAt   *time.Time `json:"answeredAt,omitempty"`

	// Joined fields (soal terkait)
	QuestionType      *string `json:"questionType,omitempty"`
	QuestionContent   *string `json:"questionContent,omitempty"`
	QuestionOptions   *string `json:"questionOptions,omitempty"`
	QuestionPoints    *int    `json:"questionPoints,omitempty"`
	Explanation       *string `json:"explanation,omitempty"`
	CorrectAnswer     *string `json:"correctAnswer,omitempty"`
}

type GradeAnswerRequest struct {
	IsCorrect *bool   `json:"isCorrect"`
	Points    float64 `json:"points"`
}

// ── Request / Response helpers ──

type CreateBabRequest struct {
	SubjectID   string  `json:"subjectId"`
	ClassID     *string `json:"classId"`
	KurikulumID *string `json:"kurikulumId"`
	Semester    *string `json:"semester"`
	Title       string  `json:"title"`
	Description *string `json:"description"`
}

type UpdateBabRequest struct {
	SubjectID   *string `json:"subjectId"`
	ClassID     *string `json:"classId"`
	KurikulumID *string `json:"kurikulumId"`
	Semester    *string `json:"semester"`
	Title       *string `json:"title"`
	Description *string `json:"description"`
}

type CreateQuestionRequest struct {
	BankID        string   `json:"bankId"`
	Type          string   `json:"type"`
	Content       string   `json:"content"`
	MediaURL      *string  `json:"mediaUrl"`
	MediaType     *string  `json:"mediaType"`
	Options       *string  `json:"options"`
	CorrectAnswer *string  `json:"correctAnswer"`
	Explanation   *string  `json:"explanation"`
	Points        int      `json:"points"`
	Difficulty    string   `json:"difficulty"`
	BloomLevel    *string  `json:"bloomLevel"`
	Tags          []string `json:"tags"`
	CreatedBy     string   `json:"-"`
}

type UpdateQuestionRequest struct {
	Type          *string  `json:"type"`
	Content       *string  `json:"content"`
	MediaURL      *string  `json:"mediaUrl"`
	MediaType     *string  `json:"mediaType"`
	Options       *string  `json:"options"`
	CorrectAnswer *string  `json:"correctAnswer"`
	Explanation   *string  `json:"explanation"`
	Points        *int     `json:"points"`
	Difficulty    *string  `json:"difficulty"`
	BloomLevel    *string  `json:"bloomLevel"`
	Tags          []string `json:"tags"`
}

type CreateQuestionBankRequest struct {
	SubjectID   string  `json:"subjectId"`
	ClassID     *string `json:"classId"`
	BabID       *string `json:"babId"`
	KurikulumID *string `json:"kurikulumId"`
	Semester    *string `json:"semester"`
	Title       string  `json:"title"`
	Description *string `json:"description"`
}

type CreateQuestionSetRequest struct {
	Name            string   `json:"name"`
	BankID          string   `json:"bankId"`
	AcademicYear    *string  `json:"academicYear"`
	Mode            string   `json:"mode"` // latihan | ujian (default latihan)
	ShuffleQuestions bool    `json:"shuffleQuestions"`
	ShuffleOptions  bool     `json:"shuffleOptions"`
	TimerMinutes    *int     `json:"timerMinutes"`
	MaxAttempts     *int     `json:"maxAttempts"`
	AvailableFrom   *int64   `json:"availableFrom"`  // Unix ms
	AvailableUntil  *int64   `json:"availableUntil"` // Unix ms
	ResultVisible   *bool    `json:"resultVisible"`
}

type UpdateQuestionSetRequest struct {
	Name            *string `json:"name"`
	BankID          *string `json:"bankId"`
	AcademicYear    *string `json:"academicYear"`
	Mode            *string `json:"mode"`
	ShuffleQuestions *bool  `json:"shuffleQuestions"`
	ShuffleOptions  *bool   `json:"shuffleOptions"`
	TimerMinutes    *int    `json:"timerMinutes"`
	MaxAttempts     *int    `json:"maxAttempts"`
	AvailableFrom   *int64  `json:"availableFrom"`
	AvailableUntil  *int64  `json:"availableUntil"`
	ResultVisible   *bool   `json:"resultVisible"`
}

// AssignClassesRequest menugaskan paket ujian ke satu/lebih kelas.
type AssignClassesRequest struct {
	ClassIDs []string `json:"classIds"`
}

type AddSetItemRequest struct {
	QuestionID string `json:"questionId"`
}

type BulkAddSetItemsRequest struct {
	QuestionIDs []string `json:"questionIds"`
}

type SubmitPracticeRequest struct {
	Answers []PracticeAnswerInput `json:"answers"`
}

type PracticeAnswerInput struct {
	QuestionID string  `json:"questionId"`
	Answer     string  `json:"answer"`
}

type QuestionBankListResponse struct {
	Data       []QuestionBank `json:"data"`
	Total      int            `json:"total"`
	TotalPages int            `json:"totalPages"`
}

type QuestionSetListResponse struct {
	Data       []QuestionSet `json:"data"`
	Total      int           `json:"total"`
	TotalPages int           `json:"totalPages"`
}

type PracticeListResponse struct {
	Data       []StudentPractice `json:"data"`
	Total      int               `json:"total"`
	TotalPages int               `json:"totalPages"`
}

// ── Analitik Paket Soal ──

// SetAnalytics merangkum performa sebuah paket.
type SetAnalytics struct {
	SetID           string  `json:"setId"`
	SetName         string  `json:"setName"`
	AttemptCount    int     `json:"attemptCount"`    // jumlah sesi selesai
	StudentCount    int     `json:"studentCount"`    // jumlah siswa unik
	AverageScore    float64 `json:"averageScore"`    // rata-rata total_score
	AverageMax      float64 `json:"averageMax"`      // rata-rata max_score
	AveragePercent  float64 `json:"averagePercent"`  // rata-rata persentase
	HighestPercent  float64 `json:"highestPercent"`
	LowestPercent   float64 `json:"lowestPercent"`
	PassRate        float64 `json:"passRate"`        // % siswa dengan skor >= 70
	PendingEssays   int     `json:"pendingEssays"`   // jawaban esai belum dikoreksi
	ScoreBuckets    []ScoreBucket `json:"scoreBuckets"`
	Items           []ItemAnalysis `json:"items"`
}

// ScoreBucket adalah distribusi nilai untuk histogram.
type ScoreBucket struct {
	Label string `json:"label"` // "0-59", "60-69", dst.
	Count int    `json:"count"`
}

// ItemAnalysis menganalisis satu soal dalam sebuah paket.
type ItemAnalysis struct {
	QuestionID     string  `json:"questionId"`
	Content        string  `json:"content"`
	Type           string  `json:"type"`
	Difficulty     string  `json:"difficulty"`
	BloomLevel     *string `json:"bloomLevel,omitempty"`
	TotalAnswered  int     `json:"totalAnswered"`  // berapa kali dijawab
	CorrectCount   int     `json:"correctCount"`
	CorrectRate    float64 `json:"correctRate"`    // 0..100
	Flag           string  `json:"flag"`           // too_easy | too_hard | ok | insufficient_data
}
