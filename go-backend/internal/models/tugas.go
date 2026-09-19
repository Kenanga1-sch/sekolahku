package models

// Tugas adalah pekerjaan rumah / tugas yang diberikan guru ke kelas yang
// diwaliinya. Siswa mengumpulkan jawaban (teks + lampiran) yang kemudian
// dinilai guru secara manual.
type Tugas struct {
	ID             string `json:"id"`
	TeacherUserID  string `json:"teacherUserId"`
	TeacherName    string `json:"teacherName,omitempty"`
	ClassID        string `json:"classId"`
	ClassName      string `json:"className,omitempty"`
	SubjectID      string `json:"subjectId,omitempty"`
	SubjectName    string `json:"subjectName,omitempty"`
	AcademicYear   string `json:"academicYear,omitempty"`
	Title          string `json:"title"`
	Description    string `json:"description,omitempty"`
	AttachmentURL  string `json:"attachmentUrl,omitempty"`
	AttachmentName string `json:"attachmentName,omitempty"`
	DueAt          *int64 `json:"dueAt,omitempty"`
	AllowLate      bool   `json:"allowLate"`
	Status         string `json:"status"` // published | archived
	CreatedAt      int64  `json:"createdAt"`
	UpdatedAt      int64  `json:"updatedAt,omitempty"`

	// Agregat pengumpulan (hanya untuk view guru).
	TotalStudents  int `json:"totalStudents,omitempty"`
	SubmittedCount int `json:"submittedCount,omitempty"`
	GradedCount    int `json:"gradedCount,omitempty"`

	// Hanya diisi untuk view siswa/orang tua (status pengumpulan sendiri).
	MySubmissionID   string   `json:"mySubmissionId,omitempty"`
	MyStatus         string   `json:"myStatus,omitempty"` // "" | submitted | graded
	MySubmittedAt    *int64   `json:"mySubmittedAt,omitempty"`
	MyIsLate         bool     `json:"myIsLate,omitempty"`
	MyScore          *float64 `json:"myScore,omitempty"`
	MyAnswerText     string   `json:"myAnswerText,omitempty"`
	MyAttachmentURL  string   `json:"myAttachmentUrl,omitempty"`
	MyAttachmentName string   `json:"myAttachmentName,omitempty"`
	MyFeedback       string   `json:"myFeedback,omitempty"`

	// Hanya diisi untuk view orang tua (tugas milik anak yang mana).
	StudentID   string `json:"studentId,omitempty"`
	StudentName string `json:"studentName,omitempty"`
}

// TugasRosterItem adalah baris roster siswa + status pengumpulan terakhirnya.
type TugasRosterItem struct {
	StudentID      string    `json:"studentId"`
	StudentName    string    `json:"studentName"`
	SubmissionID   string    `json:"submissionId,omitempty"`
	SubmittedAt    *int64    `json:"submittedAt,omitempty"`
	IsLate         bool      `json:"isLate,omitempty"`
	Score          *float64  `json:"score,omitempty"`
	Feedback       string    `json:"feedback,omitempty"`
	Status         string    `json:"status,omitempty"` // "" | submitted | graded
}

// TugasSubmission adalah satu pengumpulan tugas oleh seorang siswa.
type TugasSubmission struct {
	ID             string    `json:"id"`
	TugasID        string    `json:"tugasId"`
	StudentID      string    `json:"studentId"`
	StudentName    string    `json:"studentName,omitempty"`
	AnswerText     string    `json:"answerText,omitempty"`
	AttachmentURL  string    `json:"attachmentUrl,omitempty"`
	AttachmentName string    `json:"attachmentName,omitempty"`
	SubmittedAt    int64     `json:"submittedAt"`
	IsLate         bool      `json:"isLate"`
	Score          *float64  `json:"score,omitempty"`
	Feedback       string    `json:"feedback,omitempty"`
	GradedBy       string    `json:"gradedBy,omitempty"`
	GradedAt       *int64    `json:"gradedAt,omitempty"`
	Status         string    `json:"status"` // submitted | graded
	CreatedAt      int64     `json:"createdAt"`
	UpdatedAt      int64     `json:"updatedAt,omitempty"`
}

// ══════════════════════════════════════════════════════════
// Request DTOs
// ══════════════════════════════════════════════════════════

type CreateTugasRequest struct {
	Title          string `json:"title"`
	Description    string `json:"description"`
	SubjectID      string `json:"subjectId"`
	AttachmentURL  string `json:"attachmentUrl"`
	AttachmentName string `json:"attachmentName"`
	DueAt          *int64 `json:"dueAt"`
	AllowLate      *bool  `json:"allowLate"`
}

type UpdateTugasRequest struct {
	Title          string `json:"title"`
	Description    string `json:"description"`
	SubjectID      string `json:"subjectId"`
	AttachmentURL  string `json:"attachmentUrl"`
	AttachmentName string `json:"attachmentName"`
	DueAt          *int64 `json:"dueAt"`
	AllowLate      *bool  `json:"allowLate"`
}

type SubmitTugasRequest struct {
	AnswerText     string `json:"answerText"`
	AttachmentURL  string `json:"attachmentUrl"`
	AttachmentName string `json:"attachmentName"`
}

type GradeSubmissionRequest struct {
	Score    *float64 `json:"score"`
	Feedback string   `json:"feedback"`
}

type ArchiveTugasRequest struct {
	Archived bool `json:"archived"`
}
