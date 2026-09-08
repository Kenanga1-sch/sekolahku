package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type AlumniRepository struct {
	DB *sql.DB
}

func NewAlumniRepository(db *sql.DB) *AlumniRepository {
	repo := &AlumniRepository{DB: db}
	repo.SeedDocumentTypes()
	return repo
}

func optionalString(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	value := strings.TrimSpace(ns.String)
	if value == "" {
		return nil
	}
	return &value
}

func timeToUnixMilli(t *time.Time) interface{} {
	if t == nil || t.IsZero() {
		return nil
	}
	return t.UnixMilli()
}

func intPtr(v int) *int { return &v }

func (r *AlumniRepository) SeedDocumentTypes() {
	var count int
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni_document_types").Scan(&count)
	if count > 0 {
		return
	}
	types := []struct {
		Name     string
		Code     string
		Desc     string
		Order    int
		Required bool
	}{
		{"Ijazah", "IJZ", "Dokumen Ijazah Asli/Legalisi.", 1, true},
		{"SKHUN", "SKH", "Surat Keterangan Hasil Ujian Nasional", 2, true},
		{"Raport Akhir", "RPT", "Raport semester akhir", 3, false},
		{"SKKB", "SKB", "Surat Keterangan Kelakuan Baik", 4, false},
	}
	for _, t := range types {
		id := cuid2.Generate()
		now := time.Now().UnixMilli()
		r.DB.Exec(`INSERT INTO alumni_document_types (id, name, code, description, sort_order, is_required, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, t.Name, t.Code, t.Desc, t.Order, t.Required, now, now)
	}
}

// ───────── List ─────────

func (r *AlumniRepository) GetAlumni(page, limit int, search, year, statusFilter string) ([]models.Alumni, int, error) {
	offset := (page - 1) * limit
	query := "SELECT id, nisn, nis, full_name, gender, graduation_year, final_class, photo, next_school, nik, enrolled_year, religion, address, status, buku_fisik_no, register_no, created_at FROM alumni WHERE 1=1"
	var args []interface{}

	if search != "" {
		query += " AND (full_name LIKE ? OR nisn LIKE ? OR nis LIKE ? OR nik LIKE ? OR buku_fisik_no LIKE ? OR CAST(register_no AS TEXT) LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern, pattern, pattern, pattern)
	}
	if year != "" {
		query += " AND graduation_year = ?"
		args = append(args, year)
	}
	if statusFilter != "" {
		query += " AND status = ?"
		args = append(args, statusFilter)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM ("+query+")", args...).Scan(&total)

	query += " ORDER BY graduation_year DESC, full_name ASC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.Alumni
	for rows.Next() {
		var a models.Alumni
		var nisn, nis, gender, gradYear, fClass, photo, nSchool, nik, eYear, rel, addr, status, bukuNo sql.NullString
		var registerNo sql.NullInt64
		var crAt sql.NullInt64
		err := rows.Scan(&a.ID, &nisn, &nis, &a.FullName, &gender, &gradYear, &fClass, &photo, &nSchool,
			&nik, &eYear, &rel, &addr, &status, &bukuNo, &registerNo, &crAt)
		if err != nil {
			return nil, 0, err
		}
		a.GraduationYear = gradYear.String
		a.NISN = optionalString(nisn)
		a.NIS = optionalString(nis)
		a.Gender = optionalString(gender)
		a.FinalClass = optionalString(fClass)
		a.Photo = optionalString(photo)
		a.NextSchool = optionalString(nSchool)
		a.NIK = optionalString(nik)
		a.EnrolledYear = optionalString(eYear)
		a.Religion = optionalString(rel)
		a.Address = optionalString(addr)
		a.Status = status.String
		if a.Status == "" {
			a.Status = "graduated"
		}
		a.BukuFisikNo = optionalString(bukuNo)
		if registerNo.Valid && registerNo.Int64 > 0 {
			a.RegisterNo = intPtr(int(registerNo.Int64))
		}
		a.CreatedAt = SafeTime(crAt)
		results = append(results, a)
	}
	if results == nil {
		results = []models.Alumni{}
	}

	if len(results) > 0 {
		var ids []string
		for _, a := range results {
			ids = append(ids, a.ID)
		}
		placeholders := make([]string, len(ids))
		args2 := make([]interface{}, len(ids))
		for i, id := range ids {
			placeholders[i] = "?"
			args2[i] = id
		}
		query2 := fmt.Sprintf("SELECT alumni_id, academic_year, semester, present, sick, permission, absent, total_days FROM alumni_attendance_summary WHERE alumni_id IN (%s) ORDER BY academic_year DESC", strings.Join(placeholders, ","))
		rows2, err := r.DB.Query(query2, args2...)
		if err == nil {
			defer rows2.Close()
			summaries := make(map[string][]models.AlumniAttendanceSummary)
			for rows2.Next() {
				var s models.AlumniAttendanceSummary
				if err := rows2.Scan(&s.AlumniID, &s.AcYear, &s.Semester, &s.Present, &s.Sick, &s.Permission, &s.Absent, &s.TotalDays); err == nil {
					summaries[s.AlumniID] = append(summaries[s.AlumniID], s)
				}
			}
			for i := range results {
				results[i].AttendanceSummaries = summaries[results[i].ID]
			}
		}
	}

	return results, total, nil
}

// ───────── Get By ID ─────────

func (r *AlumniRepository) GetAlumniByID(id string) (*models.Alumni, error) {
	query := `
		SELECT id, student_id, nisn, nis, full_name, gender, birth_place, birth_date,
		       graduation_year, graduation_date, final_class, photo, parent_name,
		       parent_phone, current_address, current_phone, current_email,
		       next_school, notes, created_at, updated_at,
		       nik, religion, address, enrolled_year, previous_school,
		       father_name, father_nik, father_education, father_job,
		       mother_name, mother_nik, mother_education, mother_job,
		       guardian_name, guardian_nik, guardian_relation, guardian_job, guardian_phone,
		       sibling_count, child_order, height, weight, blood_type, medical_notes, special_needs,
		       current_occupation, current_institution, last_education_level, final_grade_avg, status,
		       nickname, citizenship, sibling_kandung, sibling_tiri, sibling_angkat,
		       daily_language, living_with, guardian_education, previous_school_address,
		       previous_school_cert_no, previous_school_cert_date,
		       mutasi_masuk_asal_sekolah, mutasi_masuk_dari_kelas, mutasi_masuk_diterima_tanggal, mutasi_masuk_di_kelas,
		       scholarship_info, mutation_out_class, mutation_out_to_school, mutation_out_to_class, mutation_out_date,
		       dropped_out_date, dropped_out_reason,
		       ijazah_no, ijazah_date, skhun_no, skhun_date,
		       father_income, mother_income, guardian_income, parent_address,
		       buku_fisik_no, register_no
		FROM alumni WHERE id = ?
	`
	var a models.Alumni
	var sid, nisn, nis, gender, bp, bd, gy, fclass, photo, pn, pp, ca, cp, ce, ns, notes sql.NullString
	var gd, crat, upat sql.NullInt64
	var nik, rel, addr, eYear, prevSch sql.NullString
	var fn, fnNik, fnEdu, fnJob sql.NullString
	var mn, mnNik, mnEdu, mnJob sql.NullString
	var gn, gnNik, gnRel, gnJob, gnPhone sql.NullString
	var sib, co, hgt, wgt sql.NullInt64
	var bt, medN, specN sql.NullString
	var coOcc, coInst, lel sql.NullString
	var fga sql.NullFloat64
	var status sql.NullString

	var nick, citizenship, dailyLang, livingWith, guardEdu, prevSchoolAddr, prevSchoolCertNo, prevSchoolCertDate sql.NullString
	var mutMasukAsal, mutMasukDari, mutMasukDiterima, mutMasukDi sql.NullString
	var scholar, mutOutClass, mutOutToSchool, mutOutToClass, mutOutDate, dropDate, dropReason sql.NullString
	var sibKandung, sibTiri, sibAngkat sql.NullInt64
	var ijazahNo, ijazahDate, skhunNo, skhunDate sql.NullString
	var fatherIncome, motherIncome, guardianIncome, parentAddr sql.NullString
	var bukuNo sql.NullString
	var registerNo sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&a.ID, &sid, &nisn, &nis, &a.FullName, &gender, &bp, &bd,
		&gy, &gd, &fclass, &photo, &pn, &pp, &ca, &cp,
		&ce, &ns, &notes, &crat, &upat,
		&nik, &rel, &addr, &eYear, &prevSch,
		&fn, &fnNik, &fnEdu, &fnJob,
		&mn, &mnNik, &mnEdu, &mnJob,
		&gn, &gnNik, &gnRel, &gnJob, &gnPhone,
		&sib, &co, &hgt, &wgt, &bt, &medN, &specN,
		&coOcc, &coInst, &lel, &fga, &status,
		&nick, &citizenship, &sibKandung, &sibTiri, &sibAngkat,
		&dailyLang, &livingWith, &guardEdu, &prevSchoolAddr,
		&prevSchoolCertNo, &prevSchoolCertDate,
		&mutMasukAsal, &mutMasukDari, &mutMasukDiterima, &mutMasukDi,
		&scholar, &mutOutClass, &mutOutToSchool, &mutOutToClass, &mutOutDate,
		&dropDate, &dropReason,
		&ijazahNo, &ijazahDate, &skhunNo, &skhunDate,
		&fatherIncome, &motherIncome, &guardianIncome, &parentAddr,
		&bukuNo, &registerNo,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	a.StudentID = optionalString(sid)
	a.GraduationYear = gy.String
	a.Status = status.String
	if a.Status == "" {
		a.Status = "graduated"
	}
	a.NISN = optionalString(nisn)
	a.NIS = optionalString(nis)
	a.Gender = optionalString(gender)
	a.BirthPlace = optionalString(bp)
	a.BirthDate = optionalString(bd)
	a.FinalClass = optionalString(fclass)
	a.Photo = optionalString(photo)
	a.ParentName = optionalString(pn)
	a.ParentPhone = optionalString(pp)
	a.CurrentAddress = optionalString(ca)
	a.CurrentPhone = optionalString(cp)
	a.CurrentEmail = optionalString(ce)
	a.NextSchool = optionalString(ns)
	a.Notes = optionalString(notes)
	a.NIK = optionalString(nik)
	a.Religion = optionalString(rel)
	a.Address = optionalString(addr)
	a.EnrolledYear = optionalString(eYear)
	a.PreviousSchool = optionalString(prevSch)
	a.FatherName = optionalString(fn)
	a.FatherNIK = optionalString(fnNik)
	a.FatherEducation = optionalString(fnEdu)
	a.FatherJob = optionalString(fnJob)
	a.MotherName = optionalString(mn)
	a.MotherNIK = optionalString(mnNik)
	a.MotherEducation = optionalString(mnEdu)
	a.MotherJob = optionalString(mnJob)
	a.GuardianName = optionalString(gn)
	a.GuardianNIK = optionalString(gnNik)
	a.GuardianRel = optionalString(gnRel)
	a.GuardianJob = optionalString(gnJob)
	a.GuardianPhone = optionalString(gnPhone)
	if sib.Valid { a.SiblingCount = intPtr(int(sib.Int64)) }
	if co.Valid { a.ChildOrder = intPtr(int(co.Int64)) }
	if hgt.Valid { a.Height = intPtr(int(hgt.Int64)) }
	if wgt.Valid { a.Weight = intPtr(int(wgt.Int64)) }
	a.BloodType = optionalString(bt)
	a.MedicalN = optionalString(medN)
	a.SpecialN = optionalString(specN)
	a.CurrentOccupation = optionalString(coOcc)
	a.CurrentInst = optionalString(coInst)
	a.LastEduLevel = optionalString(lel)
	if fga.Valid { a.FinalGradeAvg = &fga.Float64 }

	a.Nickname = optionalString(nick)
	a.Citizenship = optionalString(citizenship)
	a.SiblingKandung = int(sibKandung.Int64)
	a.SiblingTiri = int(sibTiri.Int64)
	a.SiblingAngkat = int(sibAngkat.Int64)
	a.DailyLanguage = optionalString(dailyLang)
	a.LivingWith = optionalString(livingWith)
	a.GuardianEducation = optionalString(guardEdu)
	a.PreviousSchoolAddress = optionalString(prevSchoolAddr)
	a.PreviousSchoolCertNo = optionalString(prevSchoolCertNo)
	a.PreviousSchoolCertDate = optionalString(prevSchoolCertDate)
	a.MutasiMasukAsalSekolah = optionalString(mutMasukAsal)
	a.MutasiMasukDariKelas = optionalString(mutMasukDari)
	a.MutasiMasukDiterimaTanggal = optionalString(mutMasukDiterima)
	a.MutasiMasukDiKelas = optionalString(mutMasukDi)
	a.ScholarshipInfo = optionalString(scholar)
	a.MutationOutClass = optionalString(mutOutClass)
	a.MutationOutToSchool = optionalString(mutOutToSchool)
	a.MutationOutToClass = optionalString(mutOutToClass)
	a.MutationOutDate = optionalString(mutOutDate)
	a.DroppedOutDate = optionalString(dropDate)
	a.DroppedOutReason = optionalString(dropReason)
	a.IjazahNo = optionalString(ijazahNo)
	a.IjazahDate = optionalString(ijazahDate)
	a.SkhunNo = optionalString(skhunNo)
	a.SkhunDate = optionalString(skhunDate)
	a.FatherIncome = optionalString(fatherIncome)
	a.MotherIncome = optionalString(motherIncome)
	a.GuardianIncome = optionalString(guardianIncome)
	a.ParentAddress = optionalString(parentAddr)
	a.BukuFisikNo = optionalString(bukuNo)
	if registerNo.Valid && registerNo.Int64 > 0 {
		a.RegisterNo = intPtr(int(registerNo.Int64))
	}

	a.GraduationDate = SafeTime(gd)
	a.CreatedAt = SafeTime(crat)
	a.UpdatedAt = SafeTime(upat)

	a.Documents, _ = r.GetAlumniDocuments(id)
	a.Pickups, _ = r.GetDocumentPickups(id)
	a.Transcripts, _ = r.GetTranscripts(id)
	a.Achievements, _ = r.GetAchievements(id)
	a.Extracurriculars, _ = r.GetExtracurriculars(id)
	a.AttendanceSummaries, _ = r.GetAttendanceSummaries(id)
	a.HealthRecords, _ = r.GetHealthRecords(id)
	if a.StudentID != nil && *a.StudentID != "" {
		a.ClassHistory, _ = r.GetClassHistory(*a.StudentID)
	} else {
		a.ClassHistory = []models.ClassHistoryEntry{}
	}

	return &a, nil
}

// ───────── Create ─────────

func (r *AlumniRepository) CreateAlumni(a models.Alumni) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	statusVal := a.Status
	if statusVal == "" {
		statusVal = "graduated"
	}
	_, err := r.DB.Exec(`
		INSERT INTO alumni (
			id, student_id, nisn, nis, full_name, gender, birth_place, birth_date,
			graduation_year, graduation_date, final_class, photo, parent_name, parent_phone,
			current_address, current_phone, current_email, next_school, notes,
			nik, religion, address, enrolled_year, previous_school,
			father_name, father_nik, father_education, father_job,
			mother_name, mother_nik, mother_education, mother_job,
			guardian_name, guardian_nik, guardian_relation, guardian_job, guardian_phone,
			sibling_count, child_order, height, weight, blood_type, medical_notes, special_needs,
			current_occupation, current_institution, last_education_level, final_grade_avg,
			status, created_at, updated_at,
			nickname, citizenship, sibling_kandung, sibling_tiri, sibling_angkat,
			daily_language, living_with, guardian_education, previous_school_address,
			previous_school_cert_no, previous_school_cert_date,
			mutasi_masuk_asal_sekolah, mutasi_masuk_dari_kelas, mutasi_masuk_diterima_tanggal, mutasi_masuk_di_kelas,
			scholarship_info, mutation_out_class, mutation_out_to_school, mutation_out_to_class, mutation_out_date,
			dropped_out_date, dropped_out_reason,
			ijazah_no, ijazah_date, skhun_no, skhun_date,
			father_income, mother_income, guardian_income, parent_address,
			buku_fisik_no, register_no
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
		          ?, ?, ?, ?, ?, ?,
		          ?, ?, ?, ?, ?,
		          ?, ?, ?, ?, ?,
		          ?, ?, ?, ?,
		          ?, ?, ?, ?,
		          ?, ?, ?, ?, ?,
		          ?, ?, ?, ?, ?, ?, ?,
		          ?, ?, ?, ?,
		          ?, ?, ?,
		          ?, ?, ?, ?, ?,
		          ?, ?, ?, ?,
		          ?, ?,
		          ?, ?, ?, ?,
		          ?, ?, ?, ?, ?,
		          ?, ?,
		          ?, ?, ?, ?,
		          ?, ?, ?, ?,
		          ?, ?)
	`, id, a.StudentID, a.NISN, a.NIS, a.FullName, a.Gender, a.BirthPlace, a.BirthDate,
		a.GraduationYear, timeToUnixMilli(a.GraduationDate), a.FinalClass, a.Photo, a.ParentName, a.ParentPhone,
		a.CurrentAddress, a.CurrentPhone, a.CurrentEmail, a.NextSchool, a.Notes,
		a.NIK, a.Religion, a.Address, a.EnrolledYear, a.PreviousSchool,
		a.FatherName, a.FatherNIK, a.FatherEducation, a.FatherJob,
		a.MotherName, a.MotherNIK, a.MotherEducation, a.MotherJob,
		a.GuardianName, a.GuardianNIK, a.GuardianRel, a.GuardianJob, a.GuardianPhone,
		a.SiblingCount, a.ChildOrder, a.Height, a.Weight, a.BloodType, a.MedicalN, a.SpecialN,
		a.CurrentOccupation, a.CurrentInst, a.LastEduLevel, a.FinalGradeAvg,
		statusVal, now, now,
		a.Nickname, a.Citizenship, a.SiblingKandung, a.SiblingTiri, a.SiblingAngkat,
		a.DailyLanguage, a.LivingWith, a.GuardianEducation, a.PreviousSchoolAddress,
		a.PreviousSchoolCertNo, a.PreviousSchoolCertDate,
		a.MutasiMasukAsalSekolah, a.MutasiMasukDariKelas, a.MutasiMasukDiterimaTanggal, a.MutasiMasukDiKelas,
		a.ScholarshipInfo, a.MutationOutClass, a.MutationOutToSchool, a.MutationOutToClass, a.MutationOutDate,
		a.DroppedOutDate, a.DroppedOutReason,
		a.IjazahNo, a.IjazahDate, a.SkhunNo, a.SkhunDate,
		a.FatherIncome, a.MotherIncome, a.GuardianIncome, a.ParentAddress,
		a.BukuFisikNo, a.RegisterNo,
	)
	return id, err
}

// ───────── Update ─────────

func (r *AlumniRepository) UpdateAlumni(id string, a models.Alumni) error {
	now := time.Now().UnixMilli()
	statusVal := a.Status
	if statusVal == "" {
		statusVal = "graduated"
	}
	_, err := r.DB.Exec(`
		UPDATE alumni SET
			nisn=?, nis=?, full_name=?, gender=?, birth_place=?, birth_date=?,
			graduation_year=?, graduation_date=?, final_class=?, photo=?,
			parent_name=?, parent_phone=?, current_address=?, current_phone=?, current_email=?,
			next_school=?, notes=?,
			nik=?, religion=?, address=?, enrolled_year=?, previous_school=?,
			father_name=?, father_nik=?, father_education=?, father_job=?,
			mother_name=?, mother_nik=?, mother_education=?, mother_job=?,
			guardian_name=?, guardian_nik=?, guardian_relation=?, guardian_job=?, guardian_phone=?,
			sibling_count=?, child_order=?, height=?, weight=?, blood_type=?, medical_notes=?, special_needs=?,
			current_occupation=?, current_institution=?, last_education_level=?, final_grade_avg=?,
			status=?, updated_at=?,
			nickname=?, citizenship=?, sibling_kandung=?, sibling_tiri=?, sibling_angkat=?,
			daily_language=?, living_with=?, guardian_education=?, previous_school_address=?,
			previous_school_cert_no=?, previous_school_cert_date=?,
			mutasi_masuk_asal_sekolah=?, mutasi_masuk_dari_kelas=?, mutasi_masuk_diterima_tanggal=?, mutasi_masuk_di_kelas=?,
			scholarship_info=?, mutation_out_class=?, mutation_out_to_school=?, mutation_out_to_class=?, mutation_out_date=?,
			dropped_out_date=?, dropped_out_reason=?,
			ijazah_no=?, ijazah_date=?, skhun_no=?, skhun_date=?,
			father_income=?, mother_income=?, guardian_income=?, parent_address=?,
			buku_fisik_no=?, register_no=?
		WHERE id=?
	`, a.NISN, a.NIS, a.FullName, a.Gender, a.BirthPlace, a.BirthDate,
		a.GraduationYear, timeToUnixMilli(a.GraduationDate), a.FinalClass, a.Photo,
		a.ParentName, a.ParentPhone, a.CurrentAddress, a.CurrentPhone, a.CurrentEmail,
		a.NextSchool, a.Notes,
		a.NIK, a.Religion, a.Address, a.EnrolledYear, a.PreviousSchool,
		a.FatherName, a.FatherNIK, a.FatherEducation, a.FatherJob,
		a.MotherName, a.MotherNIK, a.MotherEducation, a.MotherJob,
		a.GuardianName, a.GuardianNIK, a.GuardianRel, a.GuardianJob, a.GuardianPhone,
		a.SiblingCount, a.ChildOrder, a.Height, a.Weight, a.BloodType, a.MedicalN, a.SpecialN,
		a.CurrentOccupation, a.CurrentInst, a.LastEduLevel, a.FinalGradeAvg,
		statusVal, now,
		a.Nickname, a.Citizenship, a.SiblingKandung, a.SiblingTiri, a.SiblingAngkat,
		a.DailyLanguage, a.LivingWith, a.GuardianEducation, a.PreviousSchoolAddress,
		a.PreviousSchoolCertNo, a.PreviousSchoolCertDate,
		a.MutasiMasukAsalSekolah, a.MutasiMasukDariKelas, a.MutasiMasukDiterimaTanggal, a.MutasiMasukDiKelas,
		a.ScholarshipInfo, a.MutationOutClass, a.MutationOutToSchool, a.MutationOutToClass, a.MutationOutDate,
		a.DroppedOutDate, a.DroppedOutReason,
		a.IjazahNo, a.IjazahDate, a.SkhunNo, a.SkhunDate,
		a.FatherIncome, a.MotherIncome, a.GuardianIncome, a.ParentAddress,
		a.BukuFisikNo, a.RegisterNo,
		id,
	)
	return err
}

// ───────── Delete ─────────

func (r *AlumniRepository) DeleteAlumni(id string) error {
	_, err := r.DB.Exec("DELETE FROM alumni WHERE id = ?", id)
	return err
}

// ───────── Stats ─────────

func (r *AlumniRepository) GetAlumniStats() (*models.AlumniStats, error) {
	stats := &models.AlumniStats{}
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni").Scan(&stats.TotalAlumni)
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni_documents").Scan(&stats.TotalDocuments)
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni_documents WHERE verification_status='pending'").Scan(&stats.PendingVerification)
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni WHERE status='active'").Scan(&stats.ActiveCount)
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni WHERE status='graduated' OR status='' OR status IS NULL").Scan(&stats.GraduatedCount)
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni WHERE status='transferred'").Scan(&stats.TransferredCount)
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni WHERE status='dropped'").Scan(&stats.DroppedCount)
	return stats, nil
}

// GetAlumniGraduationYears returns distinct graduation years present in
// the data, sorted descending. Supports archives spanning decades — the
// frontend no longer guesses a fixed 10-year window.
func (r *AlumniRepository) GetAlumniGraduationYears() ([]string, error) {
	rows, err := r.DB.Query("SELECT DISTINCT graduation_year FROM alumni WHERE graduation_year IS NOT NULL AND TRIM(graduation_year) != '' ORDER BY graduation_year DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	years := []string{}
	for rows.Next() {
		var y string
		if err := rows.Scan(&y); err == nil {
			years = append(years, y)
		}
	}
	return years, nil
}

func (r *AlumniRepository) SyncFromStudents() (int, error) {
	rows, err := r.DB.Query("SELECT id FROM students WHERE is_active=1 OR status='active' OR status='aktif'")
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var studentIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			studentIDs = append(studentIDs, id)
		}
	}
	rows.Close()

	count := 0
	for _, id := range studentIDs {
		if err := AutoSyncStudentToBukuInduk(r.DB, id); err == nil {
			count++
		}
	}
	return count, nil
}

func (r *AlumniRepository) GetClassHistory(studentID string) ([]models.ClassHistoryEntry, error) {
	rows, err := r.DB.Query(
		`SELECT id, student_id, class_id, class_name, academic_year, status, record_date
		 FROM student_class_history WHERE student_id = ? ORDER BY record_date ASC`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.ClassHistoryEntry
	for rows.Next() {
		var e models.ClassHistoryEntry
		var classID, className, academicYear, status sql.NullString
		var recordDate sql.NullInt64
		if err := rows.Scan(&e.ID, &e.StudentID, &classID, &className, &academicYear, &status, &recordDate); err != nil {
			return nil, err
		}
		if classID.Valid {
			e.ClassID = &classID.String
		}
		if className.Valid {
			e.ClassName = &className.String
		}
		if academicYear.Valid {
			e.AcademicYear = &academicYear.String
		}
		if status.Valid {
			e.Status = &status.String
		}
		if recordDate.Valid {
			rd := recordDate.Int64
			e.RecordDate = &rd
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []models.ClassHistoryEntry{}
	}
	return entries, nil
}
