package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type SPMBRepository struct {
	DB *sql.DB
}

type DuplicateSPMBRegistrantError struct {
	ID                 string
	RegistrationNumber string
	StudentNIK         string
}

func (e *DuplicateSPMBRegistrantError) Error() string {
	return "nik calon siswa sudah terdaftar"
}

func NewSPMBRepository(db *sql.DB) *SPMBRepository {
	return &SPMBRepository{DB: db}
}

func parseSPMBDateMillis(value string) (int64, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, nil
	}

	layouts := []string{"2006-01-02", time.RFC3339, "2006-01-02T15:04:05.000Z"}
	var lastErr error
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed.UnixMilli(), nil
		}
		lastErr = err
	}
	return 0, lastErr
}

func periodYearFromMillis(value int64) string {
	if value == 0 {
		return fmt.Sprintf("%d", time.Now().Year())
	}
	t := SafeTime(sql.NullInt64{Int64: value, Valid: true})
	if t == nil {
		return fmt.Sprintf("%d", time.Now().Year())
	}
	return fmt.Sprintf("%d", t.Year())
}

func normalizedSPMBStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active", "aktif":
		return "active"
	case "archived", "arsip":
		return "archived"
	default:
		return "draft"
	}
}

func normalizeSPMBBirthDate(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || value == "0" {
		return ""
	}
	if millis, err := strconv.ParseInt(value, 10, 64); err == nil {
		if millis == 0 {
			return ""
		}
		if millis > 20000000000 {
			return time.UnixMilli(millis).UTC().Format("2006-01-02")
		}
		return time.Unix(millis, 0).UTC().Format("2006-01-02")
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed.Format("2006-01-02")
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed.Format("2006-01-02")
	}
	return value
}

func (r *SPMBRepository) defaultAcademicYear(startMillis int64) string {
	var academicYear sql.NullString
	err := r.DB.QueryRow(`SELECT current_academic_year FROM school_settings LIMIT 1`).Scan(&academicYear)
	if err == nil && academicYear.Valid && strings.TrimSpace(academicYear.String) != "" {
		return strings.TrimSpace(academicYear.String)
	}

	year := time.Now().Year()
	if startMillis != 0 {
		if t := SafeTime(sql.NullInt64{Int64: startMillis, Valid: true}); t != nil {
			year = t.Year()
		}
	}
	return fmt.Sprintf("%d/%d", year, year+1)
}

func (r *SPMBRepository) GetPeriods() ([]models.SPMBPeriod, error) {
	rows, err := r.DB.Query(`
		SELECT p.id, p.name, p.year, p.academic_year, COALESCE(p.committee_name, ''), p.start_date, p.end_date, p.status, p.quota, COUNT(r.id) AS registered
		FROM spmb_periods p
		LEFT JOIN spmb_registrants r ON r.period_id = p.id AND r.status NOT IN ('rejected')
		GROUP BY p.id, p.name, p.year, p.academic_year, p.committee_name, p.start_date, p.end_date, p.status, p.quota
		ORDER BY p.year DESC, p.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	periods := []models.SPMBPeriod{}
	for rows.Next() {
		var p models.SPMBPeriod
		var sd, ed sql.NullInt64
		if err := rows.Scan(&p.ID, &p.Name, &p.Year, &p.AcademicYear, &p.CommitteeName, &sd, &ed, &p.Status, &p.Quota, &p.Registered); err != nil {
			return nil, err
		}
		p.StartDate = SafeTime(sd)
		p.EndDate = SafeTime(ed)
		p.IsActive = p.Status == "active"
		periods = append(periods, p)
	}
	return periods, nil
}

func (r *SPMBRepository) CreatePeriod(req models.CreateSPMBPeriodRequest) (*models.SPMBPeriod, error) {
	id := cuid2.Generate()
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("nama periode wajib diisi")
	}
	startMillis, err := parseSPMBDateMillis(req.StartDate)
	if err != nil {
		return nil, fmt.Errorf("tanggal mulai tidak valid")
	}
	endMillis, err := parseSPMBDateMillis(req.EndDate)
	if err != nil {
		return nil, fmt.Errorf("tanggal selesai tidak valid")
	}
	if startMillis == 0 || endMillis == 0 || endMillis < startMillis {
		return nil, fmt.Errorf("rentang tanggal periode tidak valid")
	}

	year := strings.TrimSpace(req.Year)
	if year == "" {
		year = periodYearFromMillis(startMillis)
	}
	academicYear := strings.TrimSpace(req.AcademicYear)
	if academicYear == "" {
		academicYear = strings.TrimSpace(req.AcademicYearCamel)
	}
	if academicYear == "" {
		academicYear = r.defaultAcademicYear(startMillis)
	}
	quota := req.Quota
	if quota < 1 {
		quota = 100
	}
	status := normalizedSPMBStatus(req.Status)
	if req.IsActive {
		status = "active"
	}
	committeeName := strings.TrimSpace(req.CommitteeName)
	if committeeName == "" {
		committeeName = strings.TrimSpace(req.CommitteeNameSnake)
	}
	if committeeName == "" {
		committeeName = "Panitia SPMB"
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if status == "active" {
		if _, err := tx.Exec(`UPDATE spmb_periods SET status = 'draft', updated_at = ? WHERE status = 'active'`, time.Now().UnixMilli()); err != nil {
			return nil, err
		}
	}

	now := time.Now().UnixMilli()
	_, err = tx.Exec(`INSERT INTO spmb_periods (id, name, year, academic_year, committee_name, start_date, end_date, status, quota, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, name, year, academicYear, committeeName, startMillis, endMillis, status, quota, now, now)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &models.SPMBPeriod{
		ID:            id,
		Name:          name,
		Year:          year,
		AcademicYear:  academicYear,
		CommitteeName: committeeName,
		StartDate:     SafeTime(sql.NullInt64{Int64: startMillis, Valid: true}),
		EndDate:       SafeTime(sql.NullInt64{Int64: endMillis, Valid: true}),
		Status:        status,
		IsActive:      status == "active",
		Quota:         quota,
	}, nil
}

func (r *SPMBRepository) UpdatePeriod(id string, req models.UpdateSPMBPeriodRequest) error {
	var name, year, academicYear, committeeName, status string
	var startMillis, endMillis sql.NullInt64
	var quota int
	err := r.DB.QueryRow(`SELECT name, year, academic_year, COALESCE(committee_name, ''), start_date, end_date, status, quota FROM spmb_periods WHERE id = ?`, id).
		Scan(&name, &year, &academicYear, &committeeName, &startMillis, &endMillis, &status, &quota)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("periode tidak ditemukan")
		}
		return err
	}

	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
	}
	if name == "" {
		return fmt.Errorf("nama periode wajib diisi")
	}
	if req.Year != nil && strings.TrimSpace(*req.Year) != "" {
		year = strings.TrimSpace(*req.Year)
	}
	if req.AcademicYear != nil && strings.TrimSpace(*req.AcademicYear) != "" {
		academicYear = strings.TrimSpace(*req.AcademicYear)
	}
	if req.AcademicYearCamel != nil && strings.TrimSpace(*req.AcademicYearCamel) != "" {
		academicYear = strings.TrimSpace(*req.AcademicYearCamel)
	}
	if req.CommitteeName != nil {
		committeeName = strings.TrimSpace(*req.CommitteeName)
	}
	if req.CommitteeNameSnake != nil {
		committeeName = strings.TrimSpace(*req.CommitteeNameSnake)
	}
	if committeeName == "" {
		committeeName = "Panitia SPMB"
	}
	if req.StartDate != nil {
		parsed, err := parseSPMBDateMillis(*req.StartDate)
		if err != nil {
			return fmt.Errorf("tanggal mulai tidak valid")
		}
		startMillis = sql.NullInt64{Int64: parsed, Valid: parsed != 0}
	}
	if req.EndDate != nil {
		parsed, err := parseSPMBDateMillis(*req.EndDate)
		if err != nil {
			return fmt.Errorf("tanggal selesai tidak valid")
		}
		endMillis = sql.NullInt64{Int64: parsed, Valid: parsed != 0}
	}
	if startMillis.Valid && endMillis.Valid && endMillis.Int64 < startMillis.Int64 {
		return fmt.Errorf("rentang tanggal periode tidak valid")
	}
	if req.Quota != nil {
		quota = *req.Quota
	}
	if quota < 1 {
		quota = 100
	}
	if req.Status != nil {
		status = normalizedSPMBStatus(*req.Status)
	}
	if req.IsActive != nil {
		if *req.IsActive {
			status = "active"
		} else if status == "active" {
			status = "draft"
		}
	}
	if year == "" && startMillis.Valid {
		year = periodYearFromMillis(startMillis.Int64)
	}
	if academicYear == "" {
		if startMillis.Valid {
			academicYear = r.defaultAcademicYear(startMillis.Int64)
		} else {
			academicYear = r.defaultAcademicYear(0)
		}
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := time.Now().UnixMilli()
	if status == "active" {
		if _, err := tx.Exec(`UPDATE spmb_periods SET status = 'draft', updated_at = ? WHERE status = 'active' AND id <> ?`, now, id); err != nil {
			return err
		}
	}
	_, err = tx.Exec(`UPDATE spmb_periods SET name = ?, year = ?, academic_year = ?, committee_name = ?, start_date = ?, end_date = ?, status = ?, quota = ?, updated_at = ? WHERE id = ?`,
		name, year, academicYear, committeeName, startMillis.Int64, endMillis.Int64, status, quota, now, id)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *SPMBRepository) DeletePeriod(id string) error {
	var linked int
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM spmb_registrants WHERE period_id = ?`, id).Scan(&linked); err != nil {
		return err
	}
	if linked > 0 {
		return fmt.Errorf("periode masih memiliki %d pendaftar", linked)
	}
	_, err := r.DB.Exec(`DELETE FROM spmb_periods WHERE id = ?`, id)
	return err
}

func (r *SPMBRepository) GetPeriodByID(id string) (*models.SPMBPeriod, error) {
	var p models.SPMBPeriod
	var sd, ed sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT p.id, p.name, p.year, p.academic_year, COALESCE(p.committee_name, ''), p.start_date, p.end_date, p.status, p.quota, COUNT(r.id) AS registered
		FROM spmb_periods p
		LEFT JOIN spmb_registrants r ON r.period_id = p.id AND r.status NOT IN ('rejected')
		WHERE p.id = ?
		GROUP BY p.id, p.name, p.year, p.academic_year, p.committee_name, p.start_date, p.end_date, p.status, p.quota
		LIMIT 1
	`, id).
		Scan(&p.ID, &p.Name, &p.Year, &p.AcademicYear, &p.CommitteeName, &sd, &ed, &p.Status, &p.Quota, &p.Registered)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("periode tidak ditemukan")
		}
		return nil, err
	}
	p.StartDate = SafeTime(sd)
	p.EndDate = SafeTime(ed)
	p.IsActive = p.Status == "active"
	return &p, nil
}

func (r *SPMBRepository) GetActivePeriod() (*models.SPMBPeriod, error) {
	var p models.SPMBPeriod
	var sd, ed sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT p.id, p.name, p.year, p.academic_year, COALESCE(p.committee_name, ''), p.start_date, p.end_date, p.status, p.quota, COUNT(r.id) AS registered
		FROM spmb_periods p
		LEFT JOIN spmb_registrants r ON r.period_id = p.id AND r.status NOT IN ('rejected')
		WHERE p.status = 'active'
		GROUP BY p.id, p.name, p.year, p.academic_year, p.committee_name, p.start_date, p.end_date, p.status, p.quota
		LIMIT 1
	`).
		Scan(&p.ID, &p.Name, &p.Year, &p.AcademicYear, &p.CommitteeName, &sd, &ed, &p.Status, &p.Quota, &p.Registered)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	p.StartDate = SafeTime(sd)
	p.EndDate = SafeTime(ed)
	p.IsActive = true
	return &p, nil
}

func (r *SPMBRepository) GetSchoolSettings() (*models.PublicLandingData, error) {
	var s models.PublicLandingData
	var open sql.NullInt64
	var academicYear, npsn, principalName, principalNIP sql.NullString

	err := r.DB.QueryRow(`SELECT school_name, COALESCE(school_npsn, ''), school_address, school_phone, school_email, school_lat, school_lng, spmb_is_open, current_academic_year, max_distance_km, COALESCE(principal_name, ''), COALESCE(principal_nip, '') FROM school_settings LIMIT 1`).
		Scan(&s.SchoolName, &npsn, &s.SchoolAddress, &s.SchoolPhone, &s.SchoolEmail, &s.SchoolLat, &s.SchoolLng, &open, &academicYear, &s.MaxDistanceKM, &principalName, &principalNIP)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if open.Valid {
		s.SPMBIsOpen = open.Int64 != 0
	}
	if academicYear.Valid {
		s.CurrentAcademicYear = academicYear.String
	}
	if npsn.Valid {
		s.SchoolNPSN = npsn.String
	}
	if principalName.Valid {
		s.PrincipalName = principalName.String
	}
	if principalNIP.Valid {
		s.PrincipalNIP = principalNIP.String
	}

	return &s, nil
}

func (r *SPMBRepository) CreateRegistrant(reg models.SPMBRegistrant, periodID string, quota int) (string, string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	reg.StudentNIK = strings.TrimSpace(reg.StudentNIK)

	tx, err := r.DB.Begin()
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback()

	if reg.StudentNIK != "" {
		var existingID, existingRegNum string
		err := tx.QueryRow(`SELECT id, registration_number FROM spmb_registrants WHERE student_nik = ? LIMIT 1`, reg.StudentNIK).Scan(&existingID, &existingRegNum)
		if err == nil {
			return existingID, existingRegNum, &DuplicateSPMBRegistrantError{
				ID:                 existingID,
				RegistrationNumber: existingRegNum,
				StudentNIK:         reg.StudentNIK,
			}
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return "", "", err
		}
	}

	// Check quota inside transaction (atomic)
	if quota > 0 {
		var count int
		if err := tx.QueryRow(`SELECT COUNT(*) FROM spmb_registrants WHERE period_id = ?`, periodID).Scan(&count); err != nil {
			return "", "", err
		}
		if count >= quota {
			return "", "", fmt.Errorf("kuota periode SPMB sudah terpenuhi")
		}
	}

	// Generate registration number (Format: SPMB-YYYY-XXXX) inside transaction
	year := time.Now().Year()
	var lastCount int
	err = tx.QueryRow(`SELECT count(*) FROM spmb_registrants WHERE registration_number LIKE ?`, fmt.Sprintf("SPMB-%d-%%", year)).Scan(&lastCount)
	if err != nil {
		lastCount = 0
	}
	regNum := fmt.Sprintf("SPMB-%d-%04d", year, lastCount+1)

	// Calculate distance and zonasi
	var maxDistance float64
	err = tx.QueryRow(`SELECT max_distance_km FROM school_settings LIMIT 1`).Scan(&maxDistance)
	if err != nil || maxDistance == 0 {
		maxDistance = 5.0
	}

	isInZone := 0
	hasLocation := reg.HomeLat != 0 || reg.HomeLng != 0 || reg.DistanceKM > 0
	if hasLocation && reg.DistanceKM <= maxDistance {
		isInZone = 1
	}

	query := `INSERT INTO spmb_registrants (
		id, registration_number, full_name, nisn, student_nik, kk_number, 
		birth_certificate_no, birth_place, birth_date, gender, religion, 
		special_needs, living_arrangement, transport_mode, child_order, 
		has_kps_pkh, has_kip, previous_school, hobby, ambition, height, 
		weight, head_circumference, sibling_count, travel_time,
		address_street, address_rt, address_rw, address_village, postal_code, 
		home_address, home_lat, home_lng, distance_km, is_in_zone, 
		parent_phone, parent_email, father_name, father_nik, father_birth_year, 
		father_education, father_job, father_income, mother_name, mother_nik, 
		mother_birth_year, mother_education, mother_job, mother_income, 
		guardian_name, guardian_nik, guardian_birth_year, guardian_education, 
		guardian_job, guardian_income, status, period_id, created_at, updated_at
	) VALUES (
		?, ?, ?, ?, ?, ?, 
		?, ?, ?, ?, ?, 
		?, ?, ?, ?, 
		?, ?, ?, ?, ?, ?, 
		?, ?, ?, ?,
		?, ?, ?, ?, ?, 
		?, ?, ?, ?, ?, 
		?, ?, ?, ?, ?, 
		?, ?, ?, ?, ?, 
		?, ?, ?, ?, 
		?, ?, ?, ?, 
		?, ?, 'pending', ?, ?, ?
	)`

	_, err = tx.Exec(query,
		id, regNum, reg.FullName, reg.NISN, reg.StudentNIK, reg.KKNumber,
		reg.BirthCertificateNo, reg.BirthPlace, reg.BirthDate, reg.Gender, reg.Religion,
		reg.SpecialNeeds, reg.LivingArrangement, reg.TransportMode, reg.ChildOrder,
		reg.HasKPS, reg.HasKIP, reg.PreviousSchool, reg.Hobby, reg.Ambition, reg.Height,
		reg.Weight, reg.HeadCircumference, reg.SiblingCount, reg.TravelTime,
		reg.AddressStreet, reg.AddressRT, reg.AddressRW, reg.AddressVillage, reg.PostalCode,
		reg.HomeAddress, reg.HomeLat, reg.HomeLng, reg.DistanceKM, isInZone,
		reg.ParentPhone, reg.ParentEmail, reg.FatherName, reg.FatherNIK, reg.FatherBirth,
		reg.FatherEdu, reg.FatherJob, reg.FatherIncome, reg.MotherName, reg.MotherNIK,
		reg.MotherBirth, reg.MotherEdu, reg.MotherJob, reg.MotherIncome,
		reg.GuardianName, reg.GuardianNIK, reg.GuardianBirth, reg.GuardianEdu,
		reg.GuardianJob, reg.GuardianIncome, periodID, now, now,
	)
	if err != nil {
		if reg.StudentNIK != "" && strings.Contains(strings.ToLower(err.Error()), "student_nik") {
			var existingID, existingRegNum string
			if lookupErr := tx.QueryRow(`SELECT id, registration_number FROM spmb_registrants WHERE student_nik = ? LIMIT 1`, reg.StudentNIK).Scan(&existingID, &existingRegNum); lookupErr == nil {
				return existingID, existingRegNum, &DuplicateSPMBRegistrantError{
					ID:                 existingID,
					RegistrationNumber: existingRegNum,
					StudentNIK:         reg.StudentNIK,
				}
			}
		}
		return "", "", err
	}

	if err := tx.Commit(); err != nil {
		return "", "", err
	}

	return id, regNum, nil
}

func (r *SPMBRepository) GetPeriodRegistrantCount(periodID string) (int, error) {
	var count int
	err := r.DB.QueryRow(`SELECT COUNT(*) FROM spmb_registrants WHERE period_id = ?`, periodID).Scan(&count)
	return count, err
}

func (r *SPMBRepository) UpdateRegistrantDocuments(id string, documents string) error {
	query := `UPDATE spmb_registrants SET documents = ?, updated_at = ? WHERE id = ?`
	_, err := r.DB.Exec(query, documents, time.Now().UnixMilli(), id)
	return err
}

func (r *SPMBRepository) GetRegistrantByNumber(number string) (*models.SPMBRegistrant, error) {
	var reg models.SPMBRegistrant
	var bd string
	var ca, ua int64
	var verifiedAt sql.NullInt64
	var inZone int

	query := `SELECT id, registration_number, full_name, COALESCE(nisn, ''), COALESCE(student_nik, ''), COALESCE(kk_number, ''), 
		COALESCE(birth_certificate_no, ''), COALESCE(birth_place, ''), COALESCE(birth_date, ''), COALESCE(gender, ''), COALESCE(religion, ''), 
		COALESCE(special_needs, ''), COALESCE(living_arrangement, ''), COALESCE(transport_mode, ''), COALESCE(child_order, 0),
		COALESCE(has_kps_pkh, 0), COALESCE(has_kip, 0), COALESCE(previous_school, ''),
		COALESCE(hobby, ''), COALESCE(ambition, ''), COALESCE(height, 0), COALESCE(weight, 0), COALESCE(head_circumference, 0), COALESCE(sibling_count, 0), COALESCE(travel_time, ''),
		COALESCE(address_street, ''), COALESCE(address_rt, ''), COALESCE(address_rw, ''), COALESCE(address_village, ''), COALESCE(postal_code, ''), 
		COALESCE(home_address, ''), COALESCE(home_lat, 0), COALESCE(home_lng, 0), COALESCE(distance_km, 0), COALESCE(is_in_zone, 0), 
		COALESCE(parent_phone, ''), COALESCE(parent_email, ''), COALESCE(father_name, ''), COALESCE(father_nik, ''), COALESCE(father_birth_year, ''), COALESCE(father_education, ''), COALESCE(father_job, ''), COALESCE(father_income, ''),
		COALESCE(mother_name, ''), COALESCE(mother_nik, ''), COALESCE(mother_birth_year, ''), COALESCE(mother_education, ''), COALESCE(mother_job, ''), COALESCE(mother_income, ''),
		COALESCE(guardian_name, ''), COALESCE(guardian_nik, ''), COALESCE(guardian_birth_year, ''), COALESCE(guardian_education, ''), COALESCE(guardian_job, ''), COALESCE(guardian_income, ''),
		COALESCE(status, 'pending'), COALESCE(notes, ''), COALESCE(period_id, ''), COALESCE(documents, ''), verified_at, COALESCE(verified_by, ''), COALESCE(created_at, 0), COALESCE(updated_at, 0)
		FROM spmb_registrants WHERE registration_number = ? OR id = ?`

	err := r.DB.QueryRow(query, number, number).Scan(
		&reg.ID, &reg.RegistrationNumber, &reg.FullName, &reg.NISN, &reg.StudentNIK, &reg.KKNumber,
		&reg.BirthCertificateNo, &reg.BirthPlace, &bd, &reg.Gender, &reg.Religion,
		&reg.SpecialNeeds, &reg.LivingArrangement, &reg.TransportMode, &reg.ChildOrder,
		&reg.HasKPS, &reg.HasKIP, &reg.PreviousSchool,
		&reg.Hobby, &reg.Ambition, &reg.Height, &reg.Weight, &reg.HeadCircumference, &reg.SiblingCount, &reg.TravelTime,
		&reg.AddressStreet, &reg.AddressRT, &reg.AddressRW, &reg.AddressVillage, &reg.PostalCode,
		&reg.HomeAddress, &reg.HomeLat, &reg.HomeLng, &reg.DistanceKM, &inZone,
		&reg.ParentPhone, &reg.ParentEmail, &reg.FatherName, &reg.FatherNIK, &reg.FatherBirth, &reg.FatherEdu, &reg.FatherJob, &reg.FatherIncome,
		&reg.MotherName, &reg.MotherNIK, &reg.MotherBirth, &reg.MotherEdu, &reg.MotherJob, &reg.MotherIncome,
		&reg.GuardianName, &reg.GuardianNIK, &reg.GuardianBirth, &reg.GuardianEdu, &reg.GuardianJob, &reg.GuardianIncome,
		&reg.Status, &reg.Notes, &reg.PeriodID, &reg.Documents, &verifiedAt, &reg.VerifiedBy, &ca, &ua,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	reg.BirthDate = normalizeSPMBBirthDate(bd)
	reg.IsInZone = inZone == 1
	if verifiedAt.Valid {
		reg.VerifiedAt = verifiedAt.Int64
	}
	reg.CreatedAt = ca
	reg.UpdatedAt = ua

	return &reg, nil
}

func (r *SPMBRepository) GetRegistrantsAdmin(page, perPage int, status, search, periodID string) ([]models.SPMBRegistrant, int, error) {
	offset := (page - 1) * perPage
	whereClause := "1=1"
	var args []interface{}

	periodID = strings.TrimSpace(periodID)
	if periodID != "" && periodID != "all" {
		whereClause += " AND period_id = ?"
		args = append(args, periodID)
	}

	status = strings.ToLower(strings.TrimSpace(status))
	if status != "" && status != "all" {
		whereClause += " AND status = ?"
		args = append(args, status)
	}

	if search != "" {
		whereClause += " AND (full_name LIKE ? OR registration_number LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}

	query := fmt.Sprintf(`
		SELECT id, registration_number, full_name, COALESCE(student_nik, ''), COALESCE(gender, ''), COALESCE(birth_date, ''), COALESCE(distance_km, 0), COALESCE(is_in_zone, 0), COALESCE(status, 'pending'), COALESCE(created_at, 0)
		FROM spmb_registrants
		WHERE %s
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)
	countQuery := fmt.Sprintf(`SELECT count(*) FROM spmb_registrants WHERE %s`, whereClause)

	var total int
	r.DB.QueryRow(countQuery, args...).Scan(&total)

	qArgs := append(args, perPage, offset)
	rows, err := r.DB.Query(query, qArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	registrants := []models.SPMBRegistrant{}
	for rows.Next() {
		var reg models.SPMBRegistrant
		var bd string
		var inZone int
		if err := rows.Scan(&reg.ID, &reg.RegistrationNumber, &reg.FullName, &reg.StudentNIK, &reg.Gender, &bd, &reg.DistanceKM, &inZone, &reg.Status, &reg.CreatedAt); err != nil {
			return nil, 0, err
		}
		reg.BirthDate = normalizeSPMBBirthDate(bd)
		reg.IsInZone = inZone == 1
		registrants = append(registrants, reg)
	}
	return registrants, total, nil
}

func (r *SPMBRepository) UpdateRegistrantStatus(id string, status string, notes *string, verifiedBy string) error {
	status = strings.ToLower(strings.TrimSpace(status))
	switch status {
	case "pending", "verified", "accepted", "rejected", "promoted":
	default:
		return fmt.Errorf("status pendaftar tidak valid")
	}

	var periodID string
	var currentStatus string
	err := r.DB.QueryRow("SELECT period_id, status FROM spmb_registrants WHERE id = ?", id).Scan(&periodID, &currentStatus)
	if err != nil {
		return fmt.Errorf("pendaftar tidak ditemukan")
	}

	// State machine validation
	allowedTransitions := map[string][]string{
		"pending":  {"verified", "rejected"},
		"verified": {"accepted", "rejected"},
		"accepted": {"promoted"},
		"promoted": {},
		"rejected": {},
	}
	if allowed, ok := allowedTransitions[currentStatus]; !ok {
		return fmt.Errorf("status awal tidak dikenal: %s", currentStatus)
	} else {
		valid := false
		for _, s := range allowed {
			if s == status {
				valid = true
				break
			}
		}
		if !valid {
			return fmt.Errorf("transisi status tidak valid: %s → %s", currentStatus, status)
		}
	}

	// Server-side quota validation: jika akan di-accepted, pastikan masih ada kuota
	if status == "accepted" {
		if currentStatus == "accepted" {
			return fmt.Errorf("pendaftar sudah diterima sebelumnya")
		}
		var quota, accepted int
		if err := r.DB.QueryRow("SELECT quota FROM spmb_periods WHERE id = ?", periodID).Scan(&quota); err != nil {
			return fmt.Errorf("periode tidak ditemukan")
		}
		if quota > 0 {
			if err := r.DB.QueryRow("SELECT COUNT(*) FROM spmb_registrants WHERE period_id = ? AND status IN ('accepted', 'promoted')", periodID).Scan(&accepted); err != nil {
				return err
			}
			if accepted >= quota {
				return fmt.Errorf("kuota penerimaan periode sudah terpenuhi (%d/%d)", accepted, quota)
			}
		}
	}

	now := time.Now().UnixMilli()
	if notes == nil {
		_, err = r.DB.Exec(`
			UPDATE spmb_registrants
			SET status = ?,
				verified_at = CASE WHEN ? IN ('verified', 'accepted') THEN COALESCE(verified_at, ?) ELSE verified_at END,
				verified_by = CASE WHEN ? IN ('verified', 'accepted') THEN COALESCE(NULLIF(verified_by, ''), ?) ELSE verified_by END,
				updated_at = ?
			WHERE id = ?
		`, status, status, now, status, verifiedBy, now, id)
		return err
	}

	_, err = r.DB.Exec(`
		UPDATE spmb_registrants
		SET status = ?,
			notes = ?,
			verified_at = CASE WHEN ? IN ('verified', 'accepted') THEN COALESCE(verified_at, ?) ELSE verified_at END,
			verified_by = CASE WHEN ? IN ('verified', 'accepted') THEN COALESCE(NULLIF(verified_by, ''), ?) ELSE verified_by END,
			updated_at = ?
		WHERE id = ?
	`, status, *notes, status, now, status, verifiedBy, now, id)
	return err
}

func (r *SPMBRepository) DeleteRegistrant(id string) error {
	_, err := r.DB.Exec(`DELETE FROM spmb_registrants WHERE id = ?`, id)
	return err
}

func (r *SPMBRepository) GetSPMBStats(periodID string) (models.SPMBStats, error) {
	var stats models.SPMBStats
	whereClause := ""
	var args []interface{}
	periodID = strings.TrimSpace(periodID)
	if periodID != "" && periodID != "all" {
		whereClause = " WHERE period_id = ?"
		args = append(args, periodID)
	}

	runQuery := func(queryBase string, extraWhere string, dest interface{}) {
		query := queryBase
		qArgs := args
		if whereClause != "" {
			query += whereClause
			if extraWhere != "" {
				query += " AND " + extraWhere
			}
		} else if extraWhere != "" {
			query += " WHERE " + extraWhere
		}
		_ = r.DB.QueryRow(query, qArgs...).Scan(dest)
	}

	runQuery("SELECT count(*) FROM spmb_registrants", "", &stats.TotalRegistrants)
	runQuery("SELECT count(*) FROM spmb_registrants", "status = 'verified'", &stats.VerifiedRegistrants)
	runQuery("SELECT count(*) FROM spmb_registrants", "status = 'pending'", &stats.PendingRegistrants)
	runQuery("SELECT count(*) FROM spmb_registrants", "status IN ('accepted', 'promoted')", &stats.AcceptedRegistrants)
	runQuery("SELECT count(*) FROM spmb_registrants", "status = 'rejected'", &stats.RejectedRegistrants)
	return stats, nil
}

func (r *SPMBRepository) GetPublicRegistrants() ([]models.SPMBRegistrant, error) {
	rows, err := r.DB.Query(`
		SELECT registration_number, full_name, COALESCE(status, 'pending'), COALESCE(created_at, 0), COALESCE(updated_at, 0)
		FROM spmb_registrants
		WHERE status IN ('accepted', 'promoted', 'rejected')
		ORDER BY
			CASE status WHEN 'accepted' THEN 0 ELSE 1 END,
			created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	registrants := make([]models.SPMBRegistrant, 0)
	for rows.Next() {
		var reg models.SPMBRegistrant
		if err := rows.Scan(&reg.RegistrationNumber, &reg.FullName, &reg.Status, &reg.CreatedAt, &reg.UpdatedAt); err != nil {
			return nil, err
		}
		registrants = append(registrants, reg)
	}
	return registrants, rows.Err()
}

type ProcessRankedRegistrant struct {
	ID                 string
	RegistrationNumber string
	FullName           string
	Gender             string
	BirthDate          string
	DistanceKM         float64
	IsInZone           bool
	Status             string
	CreatedAt          int64
	AgeYears           int
	AgeMonths          int
	PriorityGroup      int
}

func (r *SPMBRepository) GetRegistrantsForPeriod(periodID string) ([]models.SPMBRegistrant, error) {
	rows, err := r.DB.Query(`
		SELECT id, registration_number, full_name, COALESCE(gender, ''), COALESCE(birth_date, ''), COALESCE(distance_km, 0), COALESCE(is_in_zone, 0), status, created_at
		FROM spmb_registrants WHERE period_id = ? AND status IN ('pending', 'verified')
		ORDER BY created_at ASC
	`, periodID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var regs []models.SPMBRegistrant
	for rows.Next() {
		var reg models.SPMBRegistrant
		var bd string
		var inZone int
		if err := rows.Scan(&reg.ID, &reg.RegistrationNumber, &reg.FullName, &reg.Gender, &bd, &reg.DistanceKM, &inZone, &reg.Status, &reg.CreatedAt); err != nil {
			return nil, err
		}
		reg.BirthDate = normalizeSPMBBirthDate(bd)
		reg.IsInZone = inZone == 1
		regs = append(regs, reg)
	}
	return regs, rows.Err()
}

func (r *SPMBRepository) BatchUpdateStatus(tx *sql.Tx, ids []string, status string) error {
	if len(ids) == 0 {
		return nil
	}
	now := time.Now().UnixMilli()
	stmt, err := tx.Prepare(`UPDATE spmb_registrants SET status = ?, updated_at = ? WHERE id = ?`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, id := range ids {
		if _, err := stmt.Exec(status, now, id); err != nil {
			return err
		}
	}
	return nil
}

func (r *SPMBRepository) PromoteToStudent(registrantID string, req models.SPMBPromoteRequest) error {
	if strings.TrimSpace(req.ClassID) == "" {
		return fmt.Errorf("kelas tujuan wajib dipilih")
	}

	reg, err := r.GetRegistrantByNumber(registrantID)
	if err != nil {
		return err
	}
	if reg == nil {
		return fmt.Errorf("pendaftar tidak ditemukan")
	}
	if reg.Status != "accepted" {
		return fmt.Errorf("hanya pendaftar diterima yang bisa dipromosikan")
	}

	var className sql.NullString
	if err := r.DB.QueryRow(`SELECT name FROM student_classes WHERE id = ?`, req.ClassID).Scan(&className); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("kelas tujuan tidak ditemukan")
		}
		return err
	}

	now := time.Now().UnixMilli()
	studentID := cuid2.Generate()
	_, err = r.DB.Exec(`
		INSERT INTO students (
			id, nik, nisn, full_name, gender, birth_place, birth_date, religion,
			address, father_name, father_nik, mother_name, mother_nik,
			guardian_name, guardian_nik, guardian_job, parent_phone,
			class_id, class_name, status, is_active, enrolled_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)
	`,
		studentID, reg.StudentNIK, reg.NISN, reg.FullName, reg.Gender, reg.BirthPlace, reg.BirthDate, reg.Religion,
		reg.HomeAddress, reg.FatherName, reg.FatherNIK, reg.MotherName, reg.MotherNIK,
		reg.GuardianName, reg.GuardianNIK, reg.GuardianJob, reg.ParentPhone,
		req.ClassID, className.String, now, now, now,
	)
	if err != nil {
		return err
	}

	_, err = r.DB.Exec(`UPDATE spmb_registrants SET status = 'promoted', updated_at = ? WHERE id = ?`, now, registrantID)
	return err
}
