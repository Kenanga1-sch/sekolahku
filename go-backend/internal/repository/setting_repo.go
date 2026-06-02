package repository

import (
	"database/sql"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type SettingRepository struct {
	DB *sql.DB
}

func NewSettingRepository(db *sql.DB) *SettingRepository {
	return &SettingRepository{DB: db}
}

func (r *SettingRepository) GetSettings() (*models.SchoolSettings, error) {
	query := `
		SELECT id, school_name, school_npsn, school_address, school_phone, school_email, 
		       school_website, school_logo, school_lat, school_lng, max_distance_km, 
		       spmb_is_open, current_academic_year, principal_name, principal_nip, 
		       is_maintenance, last_letter_number, letter_number_format, savings_treasurer_id,
		       school_vision, school_mission, school_indicators,
		       school_history_timeline, school_history_achievements,
		       school_curriculum, school_extracurriculars,
		       created_at, updated_at
		FROM school_settings LIMIT 1
	`
	var s models.SchoolSettings
	var npsn, addr, phone, email, web, logo, pName, pNip, treasurerId sql.NullString
	var vision, mission, indicators sql.NullString
	var historyTimeline, historyAchievements sql.NullString
	var curriculum, extras sql.NullString
	var lat, lng, dist sql.NullFloat64
	var crAt, upAt sql.NullInt64

	err := r.DB.QueryRow(query).Scan(
		&s.ID, &s.SchoolName, &npsn, &addr, &phone, &email,
		&web, &logo, &lat, &lng, &dist,
		&s.SPMBIsOpen, &s.CurrentAcademicYear, &pName, &pNip,
		&s.IsMaintenance, &s.LastLetterNumber, &s.LetterNumberFormat, &treasurerId,
		&vision, &mission, &indicators, &historyTimeline, &historyAchievements,
		&curriculum, &extras,
		&crAt, &upAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// Return default empty settings if not found
			return &models.SchoolSettings{
				SchoolName:          "Sekolahku",
				SPMBIsOpen:          false,
				CurrentAcademicYear: "2024/2025",
				LetterNumberFormat:  "421/{nomor}/SDN1-KNG/{bulan}/{tahun}",
			}, nil
		}
		return nil, err
	}

	if npsn.Valid {
		s.SchoolNPSN = &npsn.String
	}
	if addr.Valid {
		s.SchoolAddress = &addr.String
	}
	if phone.Valid {
		s.SchoolPhone = &phone.String
	}
	if email.Valid {
		s.SchoolEmail = &email.String
	}
	if web.Valid {
		s.SchoolWebsite = &web.String
	}
	if logo.Valid {
		s.SchoolLogo = &logo.String
	}
	if lat.Valid {
		s.SchoolLat = &lat.Float64
	}
	if lng.Valid {
		s.SchoolLng = &lng.Float64
	}
	if dist.Valid {
		s.MaxDistanceKM = &dist.Float64
	}
	if pName.Valid {
		s.PrincipalName = &pName.String
	}
	if pNip.Valid {
		s.PrincipalNIP = &pNip.String
	}
	if treasurerId.Valid {
		s.SavingsTreasurerID = &treasurerId.String
	}
	if vision.Valid {
		s.SchoolVision = &vision.String
	}
	if mission.Valid {
		s.SchoolMission = &mission.String
	}
	if indicators.Valid {
		s.SchoolIndicators = &indicators.String
	}
	if historyTimeline.Valid {
		s.SchoolHistoryTimeline = &historyTimeline.String
	}
	if historyAchievements.Valid {
		s.SchoolHistoryAchievements = &historyAchievements.String
	}
	if curriculum.Valid {
		s.SchoolCurriculum = &curriculum.String
	}
	if extras.Valid {
		s.SchoolExtracurriculars = &extras.String
	}

	cTime := ToTime(crAt)
	s.CreatedAt = &cTime
	uTime := ToTime(upAt)
	s.UpdatedAt = &uTime

	return &s, nil
}

func mergeSchoolSettingsPatch(next *models.SchoolSettings, existing *models.SchoolSettings) {
	if existing == nil {
		return
	}

	if next.SchoolName == "" {
		next.SchoolName = existing.SchoolName
	}
	if next.CurrentAcademicYear == "" {
		next.CurrentAcademicYear = existing.CurrentAcademicYear
	}
	if next.LetterNumberFormat == "" {
		next.LetterNumberFormat = existing.LetterNumberFormat
	}
	if next.SchoolNPSN == nil {
		next.SchoolNPSN = existing.SchoolNPSN
	}
	if next.SchoolAddress == nil {
		next.SchoolAddress = existing.SchoolAddress
	}
	if next.SchoolPhone == nil {
		next.SchoolPhone = existing.SchoolPhone
	}
	if next.SchoolEmail == nil {
		next.SchoolEmail = existing.SchoolEmail
	}
	if next.SchoolWebsite == nil {
		next.SchoolWebsite = existing.SchoolWebsite
	}
	if next.SchoolLogo == nil {
		next.SchoolLogo = existing.SchoolLogo
	}
	if next.SchoolLat == nil {
		next.SchoolLat = existing.SchoolLat
	}
	if next.SchoolLng == nil {
		next.SchoolLng = existing.SchoolLng
	}
	if next.MaxDistanceKM == nil {
		next.MaxDistanceKM = existing.MaxDistanceKM
	}
	if next.PrincipalName == nil {
		next.PrincipalName = existing.PrincipalName
	}
	if next.PrincipalNIP == nil {
		next.PrincipalNIP = existing.PrincipalNIP
	}
	if next.SavingsTreasurerID == nil {
		next.SavingsTreasurerID = existing.SavingsTreasurerID
	}
	if next.SchoolVision == nil {
		next.SchoolVision = existing.SchoolVision
	}
	if next.SchoolMission == nil {
		next.SchoolMission = existing.SchoolMission
	}
	if next.SchoolIndicators == nil {
		next.SchoolIndicators = existing.SchoolIndicators
	}
	if next.SchoolHistoryTimeline == nil {
		next.SchoolHistoryTimeline = existing.SchoolHistoryTimeline
	}
	if next.SchoolHistoryAchievements == nil {
		next.SchoolHistoryAchievements = existing.SchoolHistoryAchievements
	}
	if next.SchoolCurriculum == nil {
		next.SchoolCurriculum = existing.SchoolCurriculum
	}
	if next.SchoolExtracurriculars == nil {
		next.SchoolExtracurriculars = existing.SchoolExtracurriculars
	}
}

func (r *SettingRepository) UpdateSettings(s models.SchoolSettings) (*models.SchoolSettings, error) {
	now := time.Now().UnixMilli()

	// Check if exists
	var existingID string
	err := r.DB.QueryRow("SELECT id FROM school_settings LIMIT 1").Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	if err == sql.ErrNoRows {
		// Insert
		if s.ID == "" {
			s.ID = cuid2.Generate()
		}
		_, err = r.DB.Exec(`
			INSERT INTO school_settings (
				id, school_name, school_npsn, school_address, school_phone, school_email,
				school_website, school_logo, school_lat, school_lng, max_distance_km,
				spmb_is_open, current_academic_year, principal_name, principal_nip,
				is_maintenance, last_letter_number, letter_number_format, savings_treasurer_id,
				school_vision, school_mission, school_indicators,
				school_history_timeline, school_history_achievements,
				school_curriculum, school_extracurriculars,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, s.ID, s.SchoolName, s.SchoolNPSN, s.SchoolAddress, s.SchoolPhone, s.SchoolEmail,
			s.SchoolWebsite, s.SchoolLogo, s.SchoolLat, s.SchoolLng, s.MaxDistanceKM,
			s.SPMBIsOpen, s.CurrentAcademicYear, s.PrincipalName, s.PrincipalNIP,
			s.IsMaintenance, s.LastLetterNumber, s.LetterNumberFormat, s.SavingsTreasurerID,
			s.SchoolVision, s.SchoolMission, s.SchoolIndicators,
			s.SchoolHistoryTimeline, s.SchoolHistoryAchievements,
			s.SchoolCurriculum, s.SchoolExtracurriculars,
			now, now)
	} else {
		existing, getErr := r.GetSettings()
		if getErr != nil {
			return nil, getErr
		}
		mergeSchoolSettingsPatch(&s, existing)

		// Update
		_, err = r.DB.Exec(`
			UPDATE school_settings SET
				school_name=?, school_npsn=?, school_address=?, school_phone=?, school_email=?,
				school_website=?, school_logo=?, school_lat=?, school_lng=?, max_distance_km=?,
				spmb_is_open=?, current_academic_year=?, principal_name=?, principal_nip=?,
				is_maintenance=?, last_letter_number=?, letter_number_format=?, savings_treasurer_id=?,
				school_vision=?, school_mission=?, school_indicators=?,
				school_history_timeline=?, school_history_achievements=?,
				school_curriculum=?, school_extracurriculars=?,
				updated_at=?
			WHERE id=?
		`, s.SchoolName, s.SchoolNPSN, s.SchoolAddress, s.SchoolPhone, s.SchoolEmail,
			s.SchoolWebsite, s.SchoolLogo, s.SchoolLat, s.SchoolLng, s.MaxDistanceKM,
			s.SPMBIsOpen, s.CurrentAcademicYear, s.PrincipalName, s.PrincipalNIP,
			s.IsMaintenance, s.LastLetterNumber, s.LetterNumberFormat, s.SavingsTreasurerID,
			s.SchoolVision, s.SchoolMission, s.SchoolIndicators,
			s.SchoolHistoryTimeline, s.SchoolHistoryAchievements,
			s.SchoolCurriculum, s.SchoolExtracurriculars,
			now, existingID)
	}

	if err != nil {
		return nil, err
	}
	return r.GetSettings()
}
