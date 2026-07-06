package models

import "time"

// Alumni represents a former student record — Buku Induk
type Alumni struct {
	ID             string            `json:"id"`
	StudentID      *string           `json:"studentId"`
	NISN           *string           `json:"nisn"`
	NIS            *string           `json:"nis"`
	NIK            *string           `json:"nik"`
	Status         string            `json:"status"`
	FullName       string            `json:"fullName"`
	Gender         *string           `json:"gender"`
	BirthPlace     *string           `json:"birthPlace"`
	BirthDate      *string           `json:"birthDate"`
	Religion       *string           `json:"religion"`
	Address        *string           `json:"address"`
	EnrolledYear   *string           `json:"enrolledYear"`
	PreviousSchool *string           `json:"previousSchool"`
	GraduationYear string            `json:"graduationYear"`
	GraduationDate *time.Time        `json:"graduationDate"`
	FinalClass     *string           `json:"finalClass"`
	FinalGradeAvg  *float64          `json:"finalGradeAvg"`
	Photo          *string           `json:"photo"`
	// Family
	ParentName      *string `json:"parentName"`
	ParentPhone     *string `json:"parentPhone"`
	FatherName      *string `json:"fatherName"`
	FatherNIK       *string `json:"fatherNik"`
	FatherEducation *string `json:"fatherEducation"`
	FatherJob       *string `json:"fatherJob"`
	MotherName      *string `json:"motherName"`
	MotherNIK       *string `json:"motherNik"`
	MotherEducation *string `json:"motherEducation"`
	MotherJob       *string `json:"motherJob"`
	GuardianName    *string `json:"guardianName"`
	GuardianNIK     *string `json:"guardianNik"`
	GuardianRel     *string `json:"guardianRelation"`
	GuardianJob     *string `json:"guardianJob"`
	GuardianPhone   *string `json:"guardianPhone"`
	SiblingCount    *int    `json:"siblingCount"`
	ChildOrder      *int    `json:"childOrder"`
	// Health
	Height      *int    `json:"height"`
	Weight      *int    `json:"weight"`
	BloodType   *string `json:"bloodType"`
	MedicalN    *string `json:"medicalNotes"`
	SpecialN    *string `json:"specialNeeds"`
	// Contact
	CurrentAddress *string `json:"currentAddress"`
	CurrentPhone   *string `json:"currentPhone"`
	CurrentEmail   *string `json:"currentEmail"`
	NextSchool     *string `json:"nextSchool"`
	// Post-graduation
	CurrentOccupation *string `json:"currentOccupation"`
	CurrentInst       *string `json:"currentInstitution"`
	LastEduLevel      *string `json:"lastEducationLevel"`
	// Notes
	Notes     *string `json:"notes"`
	Documents []AlumniDocument `json:"documents,omitempty"`
	Pickups   []DocumentPickup `json:"pickups,omitempty"`
	// Buku Induk children
	Transcripts         []AlumniTranscript         `json:"transcripts,omitempty"`
	Achievements        []AlumniAchievement        `json:"achievements,omitempty"`
	Extracurriculars    []AlumniExtracurricular    `json:"extracurriculars,omitempty"`
	AttendanceSummaries []AlumniAttendanceSummary  `json:"attendanceSummaries,omitempty"`
	HealthRecords       []AlumniHealthRecord       `json:"healthRecords,omitempty"`
	// Physical register specific extensions
	Nickname                   *string `json:"nickname"`
	Citizenship                *string `json:"citizenship"`
	SiblingKandung             int     `json:"siblingKandung"`
	SiblingTiri                int     `json:"siblingTiri"`
	SiblingAngkat              int     `json:"siblingAngkat"`
	DailyLanguage              *string `json:"dailyLanguage"`
	LivingWith                 *string `json:"livingWith"`
	GuardianEducation          *string `json:"guardianEducation"`
	PreviousSchoolAddress      *string `json:"previousSchoolAddress"`
	PreviousSchoolCertNo       *string `json:"previousSchoolCertNo"`
	PreviousSchoolCertDate     *string `json:"previousSchoolCertDate"`
	MutasiMasukAsalSekolah     *string `json:"mutasiMasukAsalSekolah"`
	MutasiMasukDariKelas       *string `json:"mutasiMasukDariKelas"`
	MutasiMasukDiterimaTanggal *string `json:"mutasiMasukDiterimaTanggal"`
	MutasiMasukDiKelas         *string `json:"mutasiMasukDiKelas"`
	ScholarshipInfo            *string `json:"scholarshipInfo"`
	MutationOutClass           *string `json:"mutationOutClass"`
	MutationOutToSchool        *string `json:"mutationOutToSchool"`
	MutationOutToClass         *string `json:"mutationOutToClass"`
	MutationOutDate            *string `json:"mutationOutDate"`
	DroppedOutDate             *string `json:"droppedOutDate"`
	DroppedOutReason           *string `json:"droppedOutReason"`
	CreatedAt                  *time.Time                 `json:"createdAt"`
	UpdatedAt                  *time.Time                 `json:"updatedAt"`
}

// AlumniTranscript stores final score per subject per semester
type AlumniTranscript struct {
	ID          string    `json:"id"`
	AlumniID    string    `json:"alumniId"`
	AcYear      string    `json:"academicYear"`
	Semester    string    `json:"semester"` // Ganjil / Genap
	SubjectName string    `json:"subjectName"`
	SubjectCode *string   `json:"subjectCode"`
	Score       float64   `json:"score"`
	ScoreLetter *string   `json:"scoreLetter"`
	Notes       *string   `json:"notes"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

// AlumniAchievement represents academic / non-academic achievements
type AlumniAchievement struct {
	ID            string    `json:"id"`
	AlumniID      string    `json:"alumniId"`
	Type          string    `json:"type"` // academic, non_academic
	Title         string    `json:"title"`
	Description   *string   `json:"description"`
	Level         string    `json:"level"` // school, district, province, national, international
	Ranking       *string   `json:"ranking"`
	Year          string    `json:"year"`
	Organizer     *string   `json:"organizer"`
	CertificateURL *string  `json:"certificateUrl"`
	CreatedAt     *time.Time `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt"`
}

// AlumniExtracurricular stores extracurricular activities
type AlumniExtracurricular struct {
	ID           string    `json:"id"`
	AlumniID     string    `json:"alumniId"`
	ActivityName string    `json:"activityName"`
	Role         *string   `json:"role"`
	YearStart    *string   `json:"yearStart"`
	YearEnd      *string   `json:"yearEnd"`
	Description  *string   `json:"description"`
	CreatedAt    *time.Time `json:"createdAt"`
	UpdatedAt    *time.Time `json:"updatedAt"`
}

// AlumniAttendanceSummary stores attendance recap per semester
type AlumniAttendanceSummary struct {
	ID          string    `json:"id"`
	AlumniID    string    `json:"alumniId"`
	AcYear      string    `json:"academicYear"`
	Semester    string    `json:"semester"`
	Present     int       `json:"present"`
	Sick        int       `json:"sick"`
	Permission  int       `json:"permission"`
	Absent      int       `json:"absent"`
	TotalDays   int       `json:"totalDays"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

// AlumniHealthRecord stores annual student physical details (Grade I to VI)
type AlumniHealthRecord struct {
	ID          string     `json:"id"`
	AlumniID    string     `json:"alumniId"`
	Year        string     `json:"year"` // e.g. "Kelas I", "Kelas II"
	Weight      *int       `json:"weight"`
	Height      *int       `json:"height"`
	Illness     *string    `json:"illness"`
	Abnormality *string    `json:"abnormality"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

// AlumniDocumentType defines types of documents e.g. Ijazah, SKHUN
type AlumniDocumentType struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Code          string  `json:"code"`
	Description   *string `json:"description"`
	IsRequired    bool    `json:"isRequired"`
	MaxFileSizeMB int     `json:"maxFileSizeMb"`
	AllowedTypes  string  `json:"allowedTypes"`
	SortOrder     int     `json:"sortOrder"`
}

// AlumniDocument represents a file uploaded for an alumni
type AlumniDocument struct {
	ID                 string              `json:"id"`
	AlumniID           string              `json:"alumniId"`
	DocumentTypeID     string              `json:"documentTypeId"`
	DocumentType       *AlumniDocumentType `json:"documentType,omitempty"`
	FileName           string              `json:"fileName"`
	FilePath           string              `json:"filePath"`
	FileSize           int                 `json:"fileSize"`
	MimeType           string              `json:"mimeType"`
	DocumentNumber     *string             `json:"documentNumber"`
	IssueDate          *string             `json:"issueDate"`
	VerificationStatus string              `json:"verificationStatus"`
	VerifiedBy         *string             `json:"verifiedBy"`
	VerifiedAt         *time.Time          `json:"verifiedAt"`
	VerificationNotes  *string             `json:"verificationNotes"`
	Notes              *string             `json:"notes"`
	UploadedBy         *string             `json:"uploadedBy"`
	CreatedAt          *time.Time          `json:"createdAt"`
	UpdatedAt          *time.Time          `json:"updatedAt"`
}

// DocumentPickup tracks when physical documents are handed over
type DocumentPickup struct {
	ID                string              `json:"id"`
	AlumniID          string              `json:"alumniId"`
	DocumentTypeID    *string             `json:"documentTypeId"`
	DocumentType      *AlumniDocumentType `json:"documentType,omitempty"`
	RecipientName     string              `json:"recipientName"`
	RecipientRelation *string             `json:"recipientRelation"`
	RecipientIDNumber *string             `json:"recipientIdNumber"`
	RecipientPhone    *string             `json:"recipientPhone"`
	PickupDate        *time.Time          `json:"pickupDate"`
	SignaturePath     *string             `json:"signaturePath"`
	PhotoProofPath    *string             `json:"photoProofPath"`
	Notes             *string             `json:"notes"`
	HandedOverBy      *string             `json:"handedOverBy"`
	CreatedAt         *time.Time          `json:"createdAt"`
}

// AlumniStats represents summary data for the dashboard
type AlumniStats struct {
	TotalAlumni         int `json:"totalAlumni"`
	TotalDocuments      int `json:"totalDocuments"`
	PendingVerification int `json:"pendingVerification"`
	ActiveCount         int `json:"activeCount"`
	GraduatedCount      int `json:"graduatedCount"`
	TransferredCount    int `json:"transferredCount"`
	DroppedCount        int `json:"droppedCount"`
}

// ImportGradeRow represents a single grade record imported from e-Rapor
type ImportGradeRow struct {
	NISN         string  `json:"nisn"`
	NIS          string  `json:"nis"`
	FullName     string  `json:"fullName"`
	AcademicYear string  `json:"academicYear"`
	Semester     string  `json:"semester"`
	SubjectName  string  `json:"subjectName"`
	SubjectCode  *string `json:"subjectCode"`
	Score        float64 `json:"score"`
	Notes        *string `json:"notes"`
}
