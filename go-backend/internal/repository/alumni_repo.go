package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
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
		{"Ijazah", "IJZ", "Dokumen Ijazah Asli/Legalisir", 1, true},
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

func (r *AlumniRepository) GetAlumni(page, limit int, search, year string) ([]models.Alumni, int, error) {
	offset := (page - 1) * limit
	query := "SELECT id, nisn, nis, full_name, gender, graduation_year, final_class, photo, next_school, nik, enrolled_year, religion, address, created_at FROM alumni WHERE 1=1"
	var args []interface{}

	if search != "" {
		query += " AND (full_name LIKE ? OR nisn LIKE ? OR nis LIKE ? OR nik LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern, pattern)
	}
	if year != "" {
		query += " AND graduation_year = ?"
		args = append(args, year)
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
		var nisn, nis, gender, fClass, photo, nSchool, nik, eYear, rel, addr sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&a.ID, &nisn, &nis, &a.FullName, &gender, &a.GraduationYear, &fClass, &photo, &nSchool,
			&nik, &eYear, &rel, &addr, &crAt)
		if err != nil {
			return nil, 0, err
		}
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
		a.CreatedAt = SafeTime(crAt)
		results = append(results, a)
	}
	if results == nil {
		results = []models.Alumni{}
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
		       current_occupation, current_institution, last_education_level, final_grade_avg
		FROM alumni WHERE id = ?
	`
	var a models.Alumni
	var sid, nisn, nis, gender, bp, bd, fclass, photo, pn, pp, ca, cp, ce, ns, notes sql.NullString
	var gd, crat, upat sql.NullInt64
	var nik, rel, addr, eYear, prevSch sql.NullString
	var fn, fnNik, fnEdu, fnJob sql.NullString
	var mn, mnNik, mnEdu, mnJob sql.NullString
	var gn, gnNik, gnRel, gnJob, gnPhone sql.NullString
	var sib, co, hgt, wgt sql.NullInt64
	var bt, medN, specN sql.NullString
	var coOcc, coInst, lel sql.NullString
	var fga sql.NullFloat64

	err := r.DB.QueryRow(query, id).Scan(
		&a.ID, &sid, &nisn, &nis, &a.FullName, &gender, &bp, &bd,
		&a.GraduationYear, &gd, &fclass, &photo, &pn, &pp, &ca, &cp,
		&ce, &ns, &notes, &crat, &upat,
		&nik, &rel, &addr, &eYear, &prevSch,
		&fn, &fnNik, &fnEdu, &fnJob,
		&mn, &mnNik, &mnEdu, &mnJob,
		&gn, &gnNik, &gnRel, &gnJob, &gnPhone,
		&sib, &co, &hgt, &wgt, &bt, &medN, &specN,
		&coOcc, &coInst, &lel, &fga,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	a.StudentID = optionalString(sid)
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

	a.GraduationDate = SafeTime(gd)
	a.CreatedAt = SafeTime(crat)
	a.UpdatedAt = SafeTime(upat)

	a.Documents, _ = r.GetAlumniDocuments(id)
	a.Pickups, _ = r.GetDocumentPickups(id)
	a.Transcripts, _ = r.GetTranscripts(id)
	a.Achievements, _ = r.GetAchievements(id)
	a.Extracurriculars, _ = r.GetExtracurriculars(id)
	a.AttendanceSummaries, _ = r.GetAttendanceSummaries(id)

	return &a, nil
}

// ───────── Create ─────────

func (r *AlumniRepository) CreateAlumni(a models.Alumni) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
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
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
		          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
		          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, a.StudentID, a.NISN, a.NIS, a.FullName, a.Gender, a.BirthPlace, a.BirthDate,
		a.GraduationYear, timeToUnixMilli(a.GraduationDate), a.FinalClass, a.Photo, a.ParentName, a.ParentPhone,
		a.CurrentAddress, a.CurrentPhone, a.CurrentEmail, a.NextSchool, a.Notes,
		a.NIK, a.Religion, a.Address, a.EnrolledYear, a.PreviousSchool,
		a.FatherName, a.FatherNIK, a.FatherEducation, a.FatherJob,
		a.MotherName, a.MotherNIK, a.MotherEducation, a.MotherJob,
		a.GuardianName, a.GuardianNIK, a.GuardianRel, a.GuardianJob, a.GuardianPhone,
		a.SiblingCount, a.ChildOrder, a.Height, a.Weight, a.BloodType, a.MedicalN, a.SpecialN,
		a.CurrentOccupation, a.CurrentInst, a.LastEduLevel, a.FinalGradeAvg,
		now, now,
	)
	return id, err
}

// ───────── Update ─────────

func (r *AlumniRepository) UpdateAlumni(id string, a models.Alumni) error {
	now := time.Now().UnixMilli()
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
			updated_at=?
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
		now, id,
	)
	return err
}

// ───────── Graduate ─────────

func (r *AlumniRepository) GraduateStudents(studentIDs []string, graduationYear string, graduationDate *time.Time, deactivateStudents bool) ([]models.Alumni, int, int, error) {
	if len(studentIDs) == 0 {
		return []models.Alumni{}, 0, 0, nil
	}
	if strings.TrimSpace(graduationYear) == "" {
		return nil, 0, 0, fmt.Errorf("tahun kelulusan wajib diisi")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return nil, 0, 0, err
	}
	defer tx.Rollback()

	now := time.Now().UnixMilli()
	results := []models.Alumni{}
	created := 0
	deactivated := 0

	for _, studentID := range studentIDs {
		studentID = strings.TrimSpace(studentID)
		if studentID == "" {
			continue
		}

		// Read ALL student data
		var fullName string
		var nisn, nis, nik, gender, bp, bd, rel, addr, pn, pp, fName, fNik, fEdu, fJob sql.NullString
		var mName, mNik, mEdu, mJob, gName, gNik, gJob, className, classID, photo sql.NullString
		var crAt sql.NullInt64

		err := tx.QueryRow(`
			SELECT nisn, nis, nik, full_name, gender, birth_place, birth_date, religion, address,
			       parent_name, parent_phone,
			       father_name, father_nik, father_education, father_job,
			       mother_name, mother_nik, mother_education, mother_job,
			       guardian_name, guardian_nik, guardian_job,
			       class_name, class_id, photo, created_at
			FROM students WHERE id = ?
		`, studentID).Scan(
			&nisn, &nis, &nik, &fullName, &gender, &bp, &bd, &rel, &addr,
			&pn, &pp, &fName, &fNik, &fEdu, &fJob,
			&mName, &mNik, &mEdu, &mJob,
			&gName, &gNik, &gJob,
			&className, &classID, &photo, &crAt,
		)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, created, deactivated, fmt.Errorf("siswa tidak ditemukan: %s", studentID)
			}
			return nil, created, deactivated, err
		}

		// Look up previous_school from spmb_registrants
		var prevSch sql.NullString
		tx.QueryRow(`SELECT previous_school FROM spmb_registrants WHERE registration_number = ? OR student_nik = ? LIMIT 1`,
			optionalString(nis), optionalString(nik)).Scan(&prevSch)

		// Compute enrolled year from created_at
		var enrolledYear *string
		if crAt.Valid && crAt.Int64 > 0 {
			t := time.UnixMilli(crAt.Int64)
			y := fmt.Sprintf("%d", t.Year())
			enrolledYear = &y
		}

		// Compute grade transcript from student_grades + teacher_tp
		type transcriptRow struct {
			subject  string
			semester int
			avgScore float64
		}
		var transcriptRows []transcriptRow

		gradeRows, err := tx.Query(`
			SELECT COALESCE(tp.subject, 'Umum'), tp.semester, AVG(CAST(g.score AS REAL))
			FROM student_grades g
			JOIN teacher_tp tp ON g.tp_id = tp.id
			WHERE g.student_id = ? AND g.score IS NOT NULL
			GROUP BY tp.subject, tp.semester
		`, studentID)
		if err == nil {
			for gradeRows.Next() {
				var sub string
				var sem int
				var avg float64
				if err := gradeRows.Scan(&sub, &sem, &avg); err == nil {
					avg = math.Round(avg*100) / 100
					transcriptRows = append(transcriptRows, transcriptRow{subject: sub, semester: sem, avgScore: avg})
				}
			}
			gradeRows.Close()
		}

		// Compute attendance summary from attendance_records + attendance_sessions
		type attRow struct {
			acYear string
			sem    string
			status string
			count  int
		}
		var attRows []attRow

		attQuery, err := tx.Query(`
			SELECT COALESCE(s.class_name, 'Unknown'), s.date, ar.status, COUNT(*)
			FROM attendance_records ar
			JOIN attendance_sessions s ON ar.session_id = s.id
			WHERE ar.student_id = ?
			GROUP BY s.class_name, ar.status
		`, studentID)
		if err == nil {
			for attQuery.Next() {
				var cn, ds, st string
				var cnt int
				if err := attQuery.Scan(&cn, &ds, &st, &cnt); err == nil {
					_ = cn
					// approximate academic year & semester from date
					acYear := graduationYear
					sem := "Ganjil"
					if parsed, pErr := time.Parse("2006-01-02", ds); pErr == nil {
						m := parsed.Month()
						if m >= 6 && m <= 12 {
							sem = "Ganjil"
							acYear = fmt.Sprintf("%d/%d", parsed.Year(), parsed.Year()+1)
						} else {
							sem = "Genap"
							acYear = fmt.Sprintf("%d/%d", parsed.Year()-1, parsed.Year())
						}
					}
					attRows = append(attRows, attRow{acYear: acYear, sem: sem, status: st, count: cnt})
				}
			}
			attQuery.Close()
		}

		// Check duplicate alumni
		var existingID string
		checkArgs := []interface{}{studentID}
		checkQuery := "SELECT id FROM alumni WHERE student_id = ?"
		if nisnPtr := optionalString(nisn); nisnPtr != nil {
			checkQuery += " OR nisn = ?"
			checkArgs = append(checkArgs, *nisnPtr)
		}

		existingErr := tx.QueryRow(checkQuery+" LIMIT 1", checkArgs...).Scan(&existingID)
		alumniID := existingID
		if existingErr != nil {
			if !errors.Is(existingErr, sql.ErrNoRows) {
				return nil, created, deactivated, existingErr
			}
			alumniID = cuid2.Generate()
			_, err = tx.Exec(`
				INSERT INTO alumni (
					id, student_id, nisn, nis, full_name, gender, birth_place, birth_date,
					graduation_year, graduation_date, final_class, photo,
					parent_name, parent_phone, current_address, notes,
					nik, religion, address, enrolled_year, previous_school,
					father_name, father_nik, father_education, father_job,
					mother_name, mother_nik, mother_education, mother_job,
					guardian_name, guardian_nik, guardian_job,
					created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, alumniID, studentID,
				optionalString(nisn), optionalString(nis), fullName,
				optionalString(gender), optionalString(bp), optionalString(bd),
				graduationYear, timeToUnixMilli(graduationDate), optionalString(className),
				optionalString(photo),
				optionalString(pn), optionalString(pp), optionalString(addr), nil,
				optionalString(nik), optionalString(rel), optionalString(addr), enrolledYear,
				optionalString(prevSch),
				optionalString(fName), optionalString(fNik), optionalString(fEdu), optionalString(fJob),
				optionalString(mName), optionalString(mNik), optionalString(mEdu), optionalString(mJob),
				optionalString(gName), optionalString(gNik), optionalString(gJob),
				now, now,
			)
			if err != nil {
				return nil, created, deactivated, err
			}
			created++

			// Insert transcripts
			for _, tr := range transcriptRows {
				sem := "Genap"
				if tr.semester == 1 {
					sem = "Ganjil"
				}
				tID := cuid2.Generate()
				scoreLetter := scoreToLetter(tr.avgScore)
				tx.Exec(`INSERT INTO alumni_transcripts (id, alumni_id, academic_year, semester, subject_name, score, score_letter, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					tID, alumniID, graduationYear, sem, tr.subject, tr.avgScore, scoreLetter, now, now)
			}

			// Insert attendance summaries
			for _, ar := range attRows {
				aID := cuid2.Generate()
				pres, sick, perm, abs := 0, 0, 0, 0
				switch ar.status {
				case "hadir":
					pres = ar.count
				case "sakit":
					sick = ar.count
				case "izin":
					perm = ar.count
				case "alpha":
					abs = ar.count
				default:
					pres = ar.count
				}
				total := pres + sick + perm + abs
				tx.Exec(`INSERT INTO alumni_attendance_summary (id, alumni_id, academic_year, semester, present, sick, permission, absent, total_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					aID, alumniID, ar.acYear, ar.sem, pres, sick, perm, abs, total, now, now)
			}
		}

		if deactivateStudents {
			res, err := tx.Exec(`UPDATE students SET status='graduated', is_active=0, class_id=NULL, class_name=NULL, updated_at=? WHERE id=? AND (is_active=1 OR status!='graduated')`, now, studentID)
			if err != nil {
				return nil, created, deactivated, err
			}
			if rows, _ := res.RowsAffected(); rows > 0 {
				deactivated++
			}
		}

		historyID := cuid2.Generate()
		tx.Exec(`INSERT INTO student_class_history (id, student_id, class_id, class_name, academic_year, status, record_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			historyID, studentID, optionalString(classID), optionalString(className), graduationYear, "graduated", now)

		alumni := models.Alumni{
			ID:             alumniID,
			StudentID:      &studentID,
			NISN:           optionalString(nisn),
			NIS:            optionalString(nis),
			NIK:            optionalString(nik),
			FullName:       fullName,
			Gender:         optionalString(gender),
			BirthPlace:     optionalString(bp),
			BirthDate:      optionalString(bd),
			Religion:       optionalString(rel),
			Address:        optionalString(addr),
			EnrolledYear:   enrolledYear,
			PreviousSchool: optionalString(prevSch),
			GraduationYear: graduationYear,
			GraduationDate: graduationDate,
			FinalClass:     optionalString(className),
			Photo:          optionalString(photo),
			ParentName:     optionalString(pn),
			ParentPhone:    optionalString(pp),
			CurrentAddress: optionalString(addr),
			FatherName:     optionalString(fName),
			FatherNIK:      optionalString(fNik),
			FatherEducation: optionalString(fEdu),
			FatherJob:      optionalString(fJob),
			MotherName:     optionalString(mName),
			MotherNIK:      optionalString(mNik),
			MotherEducation: optionalString(mEdu),
			MotherJob:      optionalString(mJob),
			GuardianName:   optionalString(gName),
			GuardianNIK:    optionalString(gNik),
			GuardianJob:    optionalString(gJob),
		}
		results = append(results, alumni)
	}

	if err := tx.Commit(); err != nil {
		return nil, created, deactivated, err
	}
	return results, created, deactivated, nil
}

func scoreToLetter(score float64) *string {
	var l string
	switch {
	case score >= 90:
		l = "A"
	case score >= 78:
		l = "B"
	case score >= 65:
		l = "C"
	case score >= 50:
		l = "D"
	default:
		l = "E"
	}
	return &l
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
	return stats, nil
}

// ───────── Document Types ─────────

func (r *AlumniRepository) GetDocumentTypes() ([]models.AlumniDocumentType, error) {
	rows, err := r.DB.Query("SELECT id, name, code, description, is_required, max_file_size_mb, allowed_types, sort_order FROM alumni_document_types WHERE is_active=1 ORDER BY sort_order ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []models.AlumniDocumentType
	for rows.Next() {
		var t models.AlumniDocumentType
		var desc sql.NullString
		if err := rows.Scan(&t.ID, &t.Name, &t.Code, &desc, &t.IsRequired, &t.MaxFileSizeMB, &t.AllowedTypes, &t.SortOrder); err != nil {
			return nil, err
		}
		t.Description = optionalString(desc)
		results = append(results, t)
	}
	if results == nil {
		results = []models.AlumniDocumentType{}
	}
	return results, nil
}

// ───────── Documents ─────────

func (r *AlumniRepository) GetAlumniDocuments(alumniID string) ([]models.AlumniDocument, error) {
	rows, err := r.DB.Query(`
		SELECT d.id, d.alumni_id, d.document_type_id, d.file_name, d.file_path, d.file_size, d.mime_type,
		       d.document_number, d.issue_date, d.verification_status, d.notes, d.created_at,
		       t.name, t.code
		FROM alumni_documents d LEFT JOIN alumni_document_types t ON d.document_type_id=t.id
		WHERE d.alumni_id=?`, alumniID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []models.AlumniDocument
	for rows.Next() {
		var d models.AlumniDocument
		var t models.AlumniDocumentType
		var dn, isd, notes sql.NullString
		var crat sql.NullInt64
		if err := rows.Scan(&d.ID, &d.AlumniID, &d.DocumentTypeID, &d.FileName, &d.FilePath, &d.FileSize, &d.MimeType,
			&dn, &isd, &d.VerificationStatus, &notes, &crat, &t.Name, &t.Code); err != nil {
			return nil, err
		}
		d.DocumentNumber = optionalString(dn)
		d.IssueDate = optionalString(isd)
		d.Notes = optionalString(notes)
		d.CreatedAt = SafeTime(crat)
		t.ID = d.DocumentTypeID
		d.DocumentType = &t
		results = append(results, d)
	}
	if results == nil {
		results = []models.AlumniDocument{}
	}
	return results, nil
}

func (r *AlumniRepository) CreateDocument(d models.AlumniDocument) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`INSERT INTO alumni_documents (id, alumni_id, document_type_id, file_name, file_path, file_size, mime_type, document_number, issue_date, verification_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, d.AlumniID, d.DocumentTypeID, d.FileName, d.FilePath, d.FileSize, d.MimeType, d.DocumentNumber, d.IssueDate, "pending", d.Notes, now, now)
	return err
}

func (r *AlumniRepository) GetDocumentByID(id string) (*models.AlumniDocument, error) {
	var d models.AlumniDocument
	var t models.AlumniDocumentType
	var documentNumber, issueDate, verifiedBy, verificationNotes, notes, typeName, typeCode sql.NullString
	var verifiedAt, createdAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT d.id, d.alumni_id, d.document_type_id, d.file_name, d.file_path, d.file_size,
		       d.mime_type, d.document_number, d.issue_date, d.verification_status,
		       d.verified_by, d.verified_at, d.verification_notes, d.notes, d.created_at,
		       t.name, t.code
		FROM alumni_documents d LEFT JOIN alumni_document_types t ON d.document_type_id=t.id
		WHERE d.id=?`, id).Scan(
		&d.ID, &d.AlumniID, &d.DocumentTypeID, &d.FileName, &d.FilePath, &d.FileSize,
		&d.MimeType, &documentNumber, &issueDate, &d.VerificationStatus,
		&verifiedBy, &verifiedAt, &verificationNotes, &notes, &createdAt,
		&typeName, &typeCode)
	if err != nil {
		return nil, err
	}
	d.DocumentNumber = optionalString(documentNumber)
	d.IssueDate = optionalString(issueDate)
	d.VerifiedBy = optionalString(verifiedBy)
	d.VerifiedAt = SafeTime(verifiedAt)
	d.VerificationNotes = optionalString(verificationNotes)
	d.Notes = optionalString(notes)
	d.CreatedAt = SafeTime(createdAt)
	if typeName.Valid {
		t.ID = d.DocumentTypeID
		t.Name = typeName.String
		t.Code = typeCode.String
		d.DocumentType = &t
	}
	return &d, nil
}

func (r *AlumniRepository) VerifyDocument(id, status string, notes *string) error {
	now := time.Now().UnixMilli()
	res, err := r.DB.Exec(`UPDATE alumni_documents SET verification_status=?, verified_at=?, verification_notes=?, updated_at=? WHERE id=?`, status, now, notes, now, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *AlumniRepository) DeleteDocument(id string) (*models.AlumniDocument, error) {
	doc, err := r.GetDocumentByID(id)
	if err != nil {
		return nil, err
	}
	res, err := r.DB.Exec("DELETE FROM alumni_documents WHERE id=?", id)
	if err != nil {
		return nil, err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return nil, sql.ErrNoRows
	}
	return doc, nil
}

// ───────── Photo ─────────

func (r *AlumniRepository) UpdatePhoto(id, photoPath string) error {
	now := time.Now().UnixMilli()
	res, err := r.DB.Exec("UPDATE alumni SET photo=?, updated_at=? WHERE id=?", photoPath, now, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *AlumniRepository) RemovePhoto(id string) (string, error) {
	var photo sql.NullString
	if err := r.DB.QueryRow("SELECT photo FROM alumni WHERE id=?", id).Scan(&photo); err != nil {
		return "", err
	}
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec("UPDATE alumni SET photo=NULL, updated_at=? WHERE id=?", now, id)
	if err != nil {
		return "", err
	}
	if photo.Valid {
		return photo.String, nil
	}
	return "", nil
}

// ───────── Pickups ─────────

func (r *AlumniRepository) GetDocumentPickups(alumniID string) ([]models.DocumentPickup, error) {
	rows, err := r.DB.Query(`
		SELECT p.id, p.alumni_id, p.document_type_id, p.recipient_name, p.recipient_relation,
		       p.pickup_date, p.notes, t.name, t.code
		FROM document_pickups p LEFT JOIN alumni_document_types t ON p.document_type_id=t.id
		WHERE p.alumni_id=? ORDER BY p.pickup_date DESC`, alumniID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []models.DocumentPickup
	for rows.Next() {
		var p models.DocumentPickup
		var dt models.AlumniDocumentType
		var tid, rel, notes, tname, tcode sql.NullString
		var pdate sql.NullInt64
		if err := rows.Scan(&p.ID, &p.AlumniID, &tid, &p.RecipientName, &rel, &pdate, &notes, &tname, &tcode); err != nil {
			return nil, err
		}
		p.DocumentTypeID = optionalString(tid)
		p.RecipientRelation = optionalString(rel)
		p.Notes = optionalString(notes)
		if tname.Valid && tcode.Valid {
			dt.ID = tid.String
			dt.Name = tname.String
			dt.Code = tcode.String
			p.DocumentType = &dt
		}
		p.PickupDate = SafeTime(pdate)
		results = append(results, p)
	}
	if results == nil {
		results = []models.DocumentPickup{}
	}
	return results, nil
}

func (r *AlumniRepository) CreatePickup(p models.DocumentPickup) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	var pDate int64
	if p.PickupDate != nil {
		pDate = p.PickupDate.UnixMilli()
	} else {
		pDate = now
	}
	_, err := r.DB.Exec(`INSERT INTO document_pickups (id, alumni_id, document_type_id, recipient_name, recipient_relation, recipient_id_number, recipient_phone, pickup_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, p.AlumniID, p.DocumentTypeID, p.RecipientName, p.RecipientRelation, p.RecipientIDNumber, p.RecipientPhone, pDate, p.Notes, now)
	return err
}

// ════════════════════════════
//  BUKU INDUK CHILD TABLES
// ════════════════════════════

// ─── Transcripts ───

func (r *AlumniRepository) GetTranscripts(alumniID string) ([]models.AlumniTranscript, error) {
	rows, err := r.DB.Query(`SELECT id, alumni_id, academic_year, semester, subject_name, subject_code, score, score_letter, notes, created_at, updated_at FROM alumni_transcripts WHERE alumni_id=? ORDER BY academic_year, semester, subject_name`, alumniID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []models.AlumniTranscript
	for rows.Next() {
		var t models.AlumniTranscript
		var sc, sl, notes sql.NullString
		var cr, up sql.NullInt64
		if err := rows.Scan(&t.ID, &t.AlumniID, &t.AcYear, &t.Semester, &t.SubjectName, &sc, &t.Score, &sl, &notes, &cr, &up); err != nil {
			return nil, err
		}
		t.SubjectCode = optionalString(sc)
		t.ScoreLetter = optionalString(sl)
		t.Notes = optionalString(notes)
		t.CreatedAt = SafeTime(cr)
		t.UpdatedAt = SafeTime(up)
		res = append(res, t)
	}
	if res == nil {
		res = []models.AlumniTranscript{}
	}
	return res, nil
}

func (r *AlumniRepository) CreateTranscript(t models.AlumniTranscript) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`INSERT INTO alumni_transcripts (id, alumni_id, academic_year, semester, subject_name, subject_code, score, score_letter, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, t.AlumniID, t.AcYear, t.Semester, t.SubjectName, t.SubjectCode, t.Score, t.ScoreLetter, t.Notes, now, now)
	return id, err
}

func (r *AlumniRepository) DeleteTranscript(id string) error {
	_, err := r.DB.Exec("DELETE FROM alumni_transcripts WHERE id=?", id)
	return err
}

// ─── Achievements ───

func (r *AlumniRepository) GetAchievements(alumniID string) ([]models.AlumniAchievement, error) {
	rows, err := r.DB.Query(`SELECT id, alumni_id, type, title, description, level, ranking, year, organizer, certificate_url, created_at, updated_at FROM alumni_achievements WHERE alumni_id=? ORDER BY year DESC, created_at DESC`, alumniID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []models.AlumniAchievement
	for rows.Next() {
		var a models.AlumniAchievement
		var desc, rank, org, cert sql.NullString
		var crt, upt sql.NullInt64
		if err := rows.Scan(&a.ID, &a.AlumniID, &a.Type, &a.Title, &desc, &a.Level, &rank, &a.Year, &org, &cert, &crt, &upt); err != nil {
			return nil, err
		}
		a.Description = optionalString(desc)
		a.Ranking = optionalString(rank)
		a.Organizer = optionalString(org)
		a.CertificateURL = optionalString(cert)
		a.CreatedAt = SafeTime(crt)
		a.UpdatedAt = SafeTime(upt)
		res = append(res, a)
	}
	if res == nil {
		res = []models.AlumniAchievement{}
	}
	return res, nil
}

func (r *AlumniRepository) CreateAchievement(a models.AlumniAchievement) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`INSERT INTO alumni_achievements (id, alumni_id, type, title, description, level, ranking, year, organizer, certificate_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, a.AlumniID, a.Type, a.Title, a.Description, a.Level, a.Ranking, a.Year, a.Organizer, a.CertificateURL, now, now)
	return id, err
}

func (r *AlumniRepository) UpdateAchievement(id string, a models.AlumniAchievement) error {
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`UPDATE alumni_achievements SET type=?, title=?, description=?, level=?, ranking=?, year=?, organizer=?, certificate_url=?, updated_at=? WHERE id=?`,
		a.Type, a.Title, a.Description, a.Level, a.Ranking, a.Year, a.Organizer, a.CertificateURL, now, id)
	return err
}

func (r *AlumniRepository) DeleteAchievement(id string) error {
	_, err := r.DB.Exec("DELETE FROM alumni_achievements WHERE id=?", id)
	return err
}

// ─── Extracurriculars ───

func (r *AlumniRepository) GetExtracurriculars(alumniID string) ([]models.AlumniExtracurricular, error) {
	rows, err := r.DB.Query(`SELECT id, alumni_id, activity_name, role, year_start, year_end, description, created_at, updated_at FROM alumni_extracurriculars WHERE alumni_id=? ORDER BY year_start DESC`, alumniID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []models.AlumniExtracurricular
	for rows.Next() {
		var e models.AlumniExtracurricular
		var role, ys, ye, desc sql.NullString
		var crt, upt sql.NullInt64
		if err := rows.Scan(&e.ID, &e.AlumniID, &e.ActivityName, &role, &ys, &ye, &desc, &crt, &upt); err != nil {
			return nil, err
		}
		e.Role = optionalString(role)
		e.YearStart = optionalString(ys)
		e.YearEnd = optionalString(ye)
		e.Description = optionalString(desc)
		e.CreatedAt = SafeTime(crt)
		e.UpdatedAt = SafeTime(upt)
		res = append(res, e)
	}
	if res == nil {
		res = []models.AlumniExtracurricular{}
	}
	return res, nil
}

func (r *AlumniRepository) CreateExtracurricular(e models.AlumniExtracurricular) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`INSERT INTO alumni_extracurriculars (id, alumni_id, activity_name, role, year_start, year_end, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, e.AlumniID, e.ActivityName, e.Role, e.YearStart, e.YearEnd, e.Description, now, now)
	return id, err
}

func (r *AlumniRepository) UpdateExtracurricular(id string, e models.AlumniExtracurricular) error {
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`UPDATE alumni_extracurriculars SET activity_name=?, role=?, year_start=?, year_end=?, description=?, updated_at=? WHERE id=?`,
		e.ActivityName, e.Role, e.YearStart, e.YearEnd, e.Description, now, id)
	return err
}

func (r *AlumniRepository) DeleteExtracurricular(id string) error {
	_, err := r.DB.Exec("DELETE FROM alumni_extracurriculars WHERE id=?", id)
	return err
}

// ─── Attendance Summaries ───

func (r *AlumniRepository) GetAttendanceSummaries(alumniID string) ([]models.AlumniAttendanceSummary, error) {
	rows, err := r.DB.Query(`SELECT id, alumni_id, academic_year, semester, present, sick, permission, absent, total_days, created_at, updated_at FROM alumni_attendance_summary WHERE alumni_id=? ORDER BY academic_year, semester`, alumniID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []models.AlumniAttendanceSummary
	for rows.Next() {
		var s models.AlumniAttendanceSummary
		var cr, up sql.NullInt64
		if err := rows.Scan(&s.ID, &s.AlumniID, &s.AcYear, &s.Semester, &s.Present, &s.Sick, &s.Permission, &s.Absent, &s.TotalDays, &cr, &up); err != nil {
			return nil, err
		}
		s.CreatedAt = SafeTime(cr)
		s.UpdatedAt = SafeTime(up)
		res = append(res, s)
	}
	if res == nil {
		res = []models.AlumniAttendanceSummary{}
	}
	return res, nil
}
