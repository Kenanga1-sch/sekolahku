package models

import (
	"time"
)

type SPMBPeriod struct {
	ID            string     `json:"id"`
	Year          string     `json:"year"` // Formally school_year or year
	AcademicYear  string     `json:"academic_year"`
	Name          string     `json:"name"`
	CommitteeName string     `json:"committeeName"`
	StartDate     *time.Time `json:"startDate"`
	EndDate       *time.Time `json:"endDate"`
	Status        string     `json:"status"` // active, archived, draft
	IsActive      bool       `json:"isActive"`
	Quota         int        `json:"quota"`
	Registered    int        `json:"registered"`
	CreatedAt     *time.Time `json:"createdAt"`
}

type SPMBRegistrant struct {
	ID                 string `json:"id"`
	RegistrationNumber string `json:"registrationNumber"`
	FullName           string `json:"fullName"`
	NISN               string `json:"nisn"`
	StudentNIK         string `json:"studentNik"`
	KKNumber           string `json:"kkNumber"`
	BirthCertificateNo string `json:"birthCertificateNo"`
	BirthPlace         string `json:"birthPlace"`
	BirthDate          string `json:"birthDate"`
	Gender             string `json:"gender"`
	Religion           string `json:"religion"`
	SpecialNeeds       string `json:"specialNeeds"`
	LivingArrangement  string `json:"livingArrangement"`
	TransportMode      string `json:"transportMode"`
	ChildOrder         int    `json:"childOrder"`
	HasKPS             bool   `json:"hasKpsPkh"`
	HasKIP             bool   `json:"hasKip"`
	PreviousSchool     string `json:"previousSchool"`

	Hobby             string `json:"hobby"`
	Ambition          string `json:"ambition"`
	Height            int    `json:"height"`
	Weight            int    `json:"weight"`
	HeadCircumference int    `json:"headCircumference"`
	SiblingCount      int    `json:"siblingCount"`
	TravelTime        string `json:"travelTime"`

	AddressStreet  string  `json:"addressStreet"`
	AddressRT      string  `json:"addressRt"`
	AddressRW      string  `json:"addressRw"`
	AddressVillage string  `json:"addressVillage"`
	PostalCode     string  `json:"postalCode"`
	HomeAddress    string  `json:"address"`
	HomeLat        float64 `json:"homeLat"`
	HomeLng        float64 `json:"homeLng"`
	DistanceKM     float64 `json:"distanceToSchool"`
	IsInZone       bool    `json:"isWithinZone"`

	ParentPhone    string `json:"parentPhone"`
	ParentEmail    string `json:"parentEmail"`
	FatherName     string `json:"fatherName"`
	FatherNIK      string `json:"fatherNik"`
	FatherBirth    string `json:"fatherBirthYear"`
	FatherEdu      string `json:"fatherEducation"`
	FatherJob      string `json:"fatherJob"`
	FatherIncome   string `json:"fatherIncome"`
	MotherName     string `json:"motherName"`
	MotherNIK      string `json:"motherNik"`
	MotherBirth    string `json:"motherBirthYear"`
	MotherEdu      string `json:"motherEducation"`
	MotherJob      string `json:"motherJob"`
	MotherIncome   string `json:"motherIncome"`
	GuardianName   string `json:"guardianName"`
	GuardianNIK    string `json:"guardianNik"`
	GuardianBirth  string `json:"guardianBirthYear"`
	GuardianEdu    string `json:"guardianEducation"`
	GuardianJob    string `json:"guardianJob"`
	GuardianIncome string `json:"guardianIncome"`

	Status     string `json:"status"`
	Notes      string `json:"notes"`
	PeriodID   string `json:"periodId"`
	Documents  string `json:"documents"`
	VerifiedAt int64  `json:"verifiedAt"`
	VerifiedBy string `json:"verifiedBy"`
	CreatedAt  int64  `json:"createdAt"`
	UpdatedAt  int64  `json:"updatedAt"`
}

type SPMBStats struct {
	TotalRegistrants    int `json:"total"`
	VerifiedRegistrants int `json:"verified"`
	PendingRegistrants  int `json:"pending"`
	AcceptedRegistrants int `json:"accepted"`
	RejectedRegistrants int `json:"rejected"`
}

type PublicLandingData struct {
	SchoolName          string  `json:"school_name"`
	SchoolNPSN          string  `json:"school_npsn"`
	SchoolAddress       string  `json:"school_address"`
	SchoolPhone         string  `json:"school_phone"`
	SchoolEmail         string  `json:"school_email"`
	SchoolLat           float64 `json:"school_lat"`
	SchoolLng           float64 `json:"school_lng"`
	SPMBIsOpen          bool    `json:"spmb_is_open"`
	CurrentAcademicYear string  `json:"current_academic_year"`
	MaxDistanceKM       float64 `json:"max_distance_km"`
	PrincipalName       string  `json:"principal_name"`
	PrincipalNIP        string  `json:"principal_nip"`
}

type CreateSPMBPeriodRequest struct {
	Year               string `json:"year"`
	AcademicYear       string `json:"academic_year"`
	AcademicYearCamel  string `json:"academicYear"`
	Name               string `json:"name"`
	CommitteeName      string `json:"committeeName"`
	CommitteeNameSnake string `json:"committee_name"`
	StartDate          string `json:"startDate"`
	EndDate            string `json:"endDate"`
	Status             string `json:"status"`
	IsActive           bool   `json:"isActive"`
	Quota              int    `json:"quota"`
}

type UpdateSPMBPeriodRequest struct {
	Year               *string `json:"year"`
	AcademicYear       *string `json:"academic_year"`
	AcademicYearCamel  *string `json:"academicYear"`
	Name               *string `json:"name"`
	CommitteeName      *string `json:"committeeName"`
	CommitteeNameSnake *string `json:"committee_name"`
	StartDate          *string `json:"startDate"`
	EndDate            *string `json:"endDate"`
	Status             *string `json:"status"`
	IsActive           *bool   `json:"isActive"`
	Quota              *int    `json:"quota"`
}

type SPMBPromoteRequest struct {
	RegistrantID string `json:"registrant_id"`
	ClassID      string `json:"class_id"`
	StudentID    string `json:"student_id"` // Optional, if already exists
}
