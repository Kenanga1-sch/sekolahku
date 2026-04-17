package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type SPMBRepository struct {
	DB *sql.DB
}

func NewSPMBRepository(db *sql.DB) *SPMBRepository {
	return &SPMBRepository{DB: db}
}

func (r *SPMBRepository) GetPeriods() ([]models.SPMBPeriod, error) {
	rows, err := r.DB.Query(`SELECT id, name, year, academic_year, start_date, end_date, status, quota FROM spmb_periods ORDER BY year DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var periods []models.SPMBPeriod
	for rows.Next() {
		var p models.SPMBPeriod
		var sd, ed sql.NullInt64
		if err := rows.Scan(&p.ID, &p.Name, &p.Year, &p.AcademicYear, &sd, &ed, &p.Status, &p.Quota); err != nil {
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
	_, err := r.DB.Exec(`INSERT INTO spmb_periods (id, name, year, academic_year, start_date, end_date, status, quota, created_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
		id, req.Name, req.Year, req.AcademicYear, req.StartDate.UnixMilli(), req.EndDate.UnixMilli(), req.Quota, time.Now().UnixMilli())
	if err != nil {
		return nil, err
	}
	return &models.SPMBPeriod{ID: id, Name: req.Name, Year: req.Year, AcademicYear: req.AcademicYear}, nil
}

func (r *SPMBRepository) UpdatePeriod(id string, req models.UpdateSPMBPeriodRequest) error {
	_, err := r.DB.Exec(`UPDATE spmb_periods SET name = ?, start_date = ?, end_date = ?, status = ?, quota = ? WHERE id = ?`,
		req.Name, req.StartDate.UnixMilli(), req.EndDate.UnixMilli(), req.Status, req.Quota, id)
	return err
}

func (r *SPMBRepository) DeletePeriod(id string) error {
	_, err := r.DB.Exec(`DELETE FROM spmb_periods WHERE id = ?`, id)
	return err
}

func (r *SPMBRepository) GetActivePeriod() (*models.SPMBPeriod, error) {
	var p models.SPMBPeriod
	var sd, ed sql.NullInt64
	err := r.DB.QueryRow(`SELECT id, name, year, academic_year, start_date, end_date, status, quota FROM spmb_periods WHERE status = 'active' LIMIT 1`).
		Scan(&p.ID, &p.Name, &p.Year, &p.AcademicYear, &sd, &ed, &p.Status, &p.Quota)
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
	var academicYear sql.NullString
	
	err := r.DB.QueryRow(`SELECT school_name, school_address, school_phone, school_email, school_lat, school_lng, spmb_is_open, current_academic_year, max_distance_km FROM school_settings LIMIT 1`).
		Scan(&s.SchoolName, &s.SchoolAddress, &s.SchoolPhone, &s.SchoolEmail, &s.SchoolLat, &s.SchoolLng, &open, &academicYear, &s.MaxDistanceKM)
	
	if err != nil {
		return nil, err
	}
	if open.Valid { s.SPMBIsOpen = open.Int64 != 0 }
	if academicYear.Valid { s.CurrentAcademicYear = academicYear.String }

	return &s, nil
}

func (r *SPMBRepository) CreateRegistrant(reg models.SPMBRegistrant) (string, string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	// 1. Generate registration number (Format: SPMB-YYYY-XXXX)
	year := time.Now().Year()
	
	var lastCount int
	err := r.DB.QueryRow(`SELECT count(*) FROM spmb_registrants WHERE registration_number LIKE ?`, fmt.Sprintf("SPMB-%d-%%", year)).Scan(&lastCount)
	if err != nil {
		lastCount = 0
	}
	regNum := fmt.Sprintf("SPMB-%d-%04d", year, lastCount+1)

	// 2. Map birth date to unix if possible
	var birthDateUnix int64
	if reg.BirthDate != "" {
		t, err := time.Parse("2006-01-02", reg.BirthDate)
		if err == nil {
			birthDateUnix = t.UnixMilli()
		}
	}

	// 3. Calculate distance and zonasi
	var maxDistance float64
	err = r.DB.QueryRow(`SELECT max_distance_km FROM school_settings LIMIT 1`).Scan(&maxDistance)
	if err != nil || maxDistance == 0 {
		maxDistance = 5.0 // Default 5km
	}

	isInZone := 0
	if reg.DistanceKM <= maxDistance {
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
		guardian_job, guardian_income, status, created_at, updated_at
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
		?, ?, 'pending', ?, ?
	)`

	_, err = r.DB.Exec(query,
		id, regNum, reg.FullName, reg.NISN, reg.StudentNIK, reg.KKNumber,
		reg.BirthCertificateNo, reg.BirthPlace, birthDateUnix, reg.Gender, reg.Religion,
		reg.SpecialNeeds, reg.LivingArrangement, reg.TransportMode, reg.ChildOrder,
		reg.HasKPS, reg.HasKIP, reg.PreviousSchool, reg.Hobby, reg.Ambition, reg.Height,
		reg.Weight, reg.HeadCircumference, reg.SiblingCount, reg.TravelTime,
		reg.AddressStreet, reg.AddressRT, reg.AddressRW, reg.AddressVillage, reg.PostalCode,
		reg.HomeAddress, reg.HomeLat, reg.HomeLng, reg.DistanceKM, isInZone,
		reg.ParentPhone, reg.ParentEmail, reg.FatherName, reg.FatherNIK, reg.FatherBirth,
		reg.FatherEdu, reg.FatherJob, reg.FatherIncome, reg.MotherName, reg.MotherNIK,
		reg.MotherBirth, reg.MotherEdu, reg.MotherJob, reg.MotherIncome,
		reg.GuardianName, reg.GuardianNIK, reg.GuardianBirth, reg.GuardianEdu,
		reg.GuardianJob, reg.GuardianIncome, now, now,
	)

	return id, regNum, err
}

func (r *SPMBRepository) UpdateRegistrantDocuments(id string, documents string) error {
	query := `UPDATE spmb_registrants SET documents = ?, updated_at = ? WHERE id = ?`
	_, err := r.DB.Exec(query, documents, time.Now().UnixMilli(), id)
	return err
}

func (r *SPMBRepository) GetRegistrantByNumber(number string) (*models.SPMBRegistrant, error) {
	var reg models.SPMBRegistrant
	var bd int64
	var ca, ua int64
	var inZone int

	query := `SELECT id, registration_number, full_name, nisn, student_nik, kk_number, 
		birth_certificate_no, birth_place, birth_date, gender, religion, 
		address_street, address_rt, address_rw, address_village, postal_code, 
		home_address, home_lat, home_lng, distance_km, is_in_zone, 
		parent_phone, parent_email, father_name, father_nik, father_education, 
		mother_name, mother_nik, mother_education, status, documents, created_at, updated_at 
		FROM spmb_registrants WHERE registration_number = ? OR id = ?`

	err := r.DB.QueryRow(query, number, number).Scan(
		&reg.ID, &reg.RegistrationNumber, &reg.FullName, &reg.NISN, &reg.StudentNIK, &reg.KKNumber,
		&reg.BirthCertificateNo, &reg.BirthPlace, &bd, &reg.Gender, &reg.Religion,
		&reg.AddressStreet, &reg.AddressRT, &reg.AddressRW, &reg.AddressVillage, &reg.PostalCode,
		&reg.HomeAddress, &reg.HomeLat, &reg.HomeLng, &reg.DistanceKM, &inZone,
		&reg.ParentPhone, &reg.ParentEmail, &reg.FatherName, &reg.FatherNIK, &reg.FatherEdu,
		&reg.MotherName, &reg.MotherNIK, &reg.MotherEdu, &reg.Status, &reg.Documents, &ca, &ua,
	)

	if err != nil {
		if err == sql.ErrNoRows { return nil, nil }
		return nil, err
	}

	reg.BirthDate = time.UnixMilli(bd).Format("2006-01-02")
	reg.IsInZone = inZone == 1
	reg.CreatedAt = ca
	reg.UpdatedAt = ua

	return &reg, nil
}

func (r *SPMBRepository) GetRegistrantsAdmin(page, perPage int, status, search string) ([]models.SPMBRegistrant, int, error) {
	offset := (page - 1) * perPage
	whereClause := "1=1"
	var args []interface{}

	if status != "" {
		whereClause += " AND status = ?"
		args = append(args, status)
	}

	if search != "" {
		whereClause += " AND (full_name LIKE ? OR registration_number LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}

	query := fmt.Sprintf(`SELECT id, registration_number, full_name, student_nik, status, created_at FROM spmb_registrants WHERE %s ORDER BY created_at DESC LIMIT ? OFFSET ?`, whereClause)
	countQuery := fmt.Sprintf(`SELECT count(*) FROM spmb_registrants WHERE %s`, whereClause)

	var total int
	r.DB.QueryRow(countQuery, args...).Scan(&total)

	qArgs := append(args, perPage, offset)
	rows, err := r.DB.Query(query, qArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var registrants []models.SPMBRegistrant
	for rows.Next() {
		var reg models.SPMBRegistrant
		if err := rows.Scan(&reg.ID, &reg.RegistrationNumber, &reg.FullName, &reg.StudentNIK, &reg.Status, &reg.CreatedAt); err != nil {
			return nil, 0, err
		}
		registrants = append(registrants, reg)
	}
	return registrants, total, nil
}

func (r *SPMBRepository) UpdateRegistrantStatus(id string, status string) error {
	_, err := r.DB.Exec(`UPDATE spmb_registrants SET status = ?, updated_at = ? WHERE id = ?`, status, time.Now().UnixMilli(), id)
	return err
}

func (r *SPMBRepository) DeleteRegistrant(id string) error {
	_, err := r.DB.Exec(`DELETE FROM spmb_registrants WHERE id = ?`, id)
	return err
}

func (r *SPMBRepository) GetSPMBStats() (models.SPMBStats, error) {
	var stats models.SPMBStats
	_ = r.DB.QueryRow(`SELECT count(*) FROM spmb_registrants`).Scan(&stats.TotalRegistrants)
	_ = r.DB.QueryRow(`SELECT count(*) FROM spmb_registrants WHERE status = 'verified'`).Scan(&stats.VerifiedRegistrants)
	_ = r.DB.QueryRow(`SELECT count(*) FROM spmb_registrants WHERE status = 'pending'`).Scan(&stats.PendingRegistrants)
	_ = r.DB.QueryRow(`SELECT count(*) FROM spmb_registrants WHERE status = 'accepted'`).Scan(&stats.AcceptedRegistrants)
	return stats, nil
}

func (r *SPMBRepository) GetPublicRegistrants() (int, error) {
	var count int
	err := r.DB.QueryRow(`SELECT count(*) FROM spmb_registrants`).Scan(&count)
	return count, err
}

func (r *SPMBRepository) PromoteToStudent(registrantID string, req models.SPMBPromoteRequest) error {
	// 1. Get registrant data
	var reg models.SPMBRegistrant
	err := r.DB.QueryRow(`SELECT full_name, gender, birth_place, birth_date, student_nik, address_village FROM spmb_registrants WHERE id = ?`, registrantID).
		Scan(&reg.FullName, &reg.Gender, &reg.BirthPlace, &reg.BirthDate, &reg.StudentNIK, &reg.AddressVillage)
	if err != nil {
		return err
	}

	// 2. Create student
	studentID := cuid2.Generate()
	_, err = r.DB.Exec(`INSERT INTO students (id, full_name, gender, birth_place, birth_date, nik, address, current_class_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
		studentID, reg.FullName, reg.Gender, reg.BirthPlace, reg.BirthDate, reg.StudentNIK, reg.AddressVillage, req.ClassID, time.Now().UnixMilli())
	if err != nil {
		return err
	}

	// 3. Update registrant status
	_, err = r.DB.Exec(`UPDATE spmb_registrants SET status = 'accepted', updated_at = ? WHERE id = ?`, time.Now().UnixMilli(), registrantID)
	return err
}

