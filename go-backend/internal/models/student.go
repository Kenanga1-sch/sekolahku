package models

import "time"

type Student struct {
	ID                 string     `json:"id"`
	NIK                *string    `json:"nik"`
	NISN               *string    `json:"nisn"`
	NIS                *string    `json:"nis"`
	KIP                *string    `json:"kip"`
	FullName           string     `json:"fullName"` // Matches frontend expectation
	Gender             *string    `json:"gender"`
	BirthPlace         *string    `json:"birthPlace"`
	BirthDate          *string    `json:"birthDate"`
	Religion           *string    `json:"religion"`
	Address            *string    `json:"address"`
	ParentName         *string    `json:"parentName"`
	FatherName         *string    `json:"fatherName"`
	FatherNIK          *string    `json:"fatherNik"`
	MotherName         *string    `json:"motherName"`
	MotherNIK          *string    `json:"motherNik"`
	GuardianName       *string    `json:"guardianName"`
	GuardianNIK        *string    `json:"guardianNik"`
	GuardianJob        *string    `json:"guardianJob"`
	ParentPhone        *string    `json:"parentPhone"`
	ClassName          *string    `json:"className"`
	ClassID            *string    `json:"classId"`
	Status             string     `json:"status"`
	Photo              *string    `json:"photo"`
	QRCode             string     `json:"qrCode"`
	IsActive           bool       `json:"isActive"`
	MetaData           *string    `json:"metaData"`
	EnrolledAt         *int64     `json:"enrolledAt"`
	CreatedAt          *time.Time `json:"createdAt"`
	UpdatedAt          *time.Time `json:"updatedAt"`
}

type StudentSubjectGrade struct {
	Subject   string  `json:"subject"`
	Semester  int     `json:"semester"`
	AvgScore  float64 `json:"avgScore"`
}


type StudentByClass struct {
	ClassName *string `json:"className"`
	Count     int     `json:"count"`
}

type StudentPagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

type StudentSummary struct {
	Total   int              `json:"total"`
	Active  int              `json:"active"`
	Male    int              `json:"male"`
	Female  int              `json:"female"`
	ByClass []StudentByClass `json:"byClass"`
}

type StudentResponse struct {
	Data       []Student         `json:"data"`
	Pagination StudentPagination `json:"pagination"`
	Summary    StudentSummary    `json:"summary"`
}

type StudentHealth struct {
	TotalStudents int `json:"totalStudents"`
	MissingNik    int `json:"missingNik"`
	MissingMother int `json:"missingMother"`
	MissingDocs   int `json:"missingDocs"`
	Completeness  int `json:"completeness"`
}

type StudentClassItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
