package models

import "time"

type SchoolSettings struct {
	ID                  string     `json:"id"`
	SchoolName          string     `json:"school_name"`
	SchoolNPSN          *string    `json:"school_npsn"`
	SchoolAddress       *string    `json:"school_address"`
	SchoolPhone         *string    `json:"school_phone"`
	SchoolEmail         *string    `json:"school_email"`
	SchoolWebsite       *string    `json:"school_website"`
	SchoolLogo          *string    `json:"school_logo"`
	SchoolLat           *float64   `json:"school_lat"`
	SchoolLng           *float64   `json:"school_lng"`
	MaxDistanceKM       *float64   `json:"max_distance_km"`
	SPMBIsOpen          bool       `json:"spmb_is_open"`
	CurrentAcademicYear string     `json:"current_academic_year"`
	PrincipalName       *string    `json:"principal_name"`
	PrincipalNIP        *string    `json:"principal_nip"`
	IsMaintenance       bool       `json:"is_maintenance"`
	LastLetterNumber    int        `json:"last_letter_number"`
	LetterNumberFormat  string     `json:"letter_number_format"`
	SavingsTreasurerID  *string    `json:"savings_treasurer_id"`
	SchoolVision        *string    `json:"school_vision"`
	SchoolMission       *string    `json:"school_mission"`
	SchoolIndicators    *string    `json:"school_indicators"`
	SchoolHistoryTimeline     *string    `json:"school_history_timeline"`
	SchoolHistoryAchievements *string    `json:"school_history_achievements"`
	SchoolCurriculum          *string    `json:"school_curriculum"`
	SchoolExtracurriculars    *string    `json:"school_extracurriculars"`
	LandingTagline            *string    `json:"landing_tagline"`
	LandingDescription        *string    `json:"landing_description"`
	LandingTexts              *string    `json:"landing_texts"`
	LandingSections           *string    `json:"landing_sections"`
	CreatedAt                 *time.Time `json:"created_at"`
	UpdatedAt                 *time.Time `json:"updated_at"`
}
