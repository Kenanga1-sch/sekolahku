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

// GraduateStudents graduates selected students into alumni records
func (r *AlumniRepository) GraduateStudents(studentIDs []string, graduationYear string, graduationDate *time.Time, deactivateStudents bool) ([]models.Alumni, int, int, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, 0, 0, err
	}
	defer tx.Rollback()

	if graduationYear == "" {
		graduationYear = time.Now().Format("2006")
	}
	gd := time.Now()
	if graduationDate != nil {
		gd = *graduationDate
	}
	now := time.Now().UnixMilli()

	created := 0
	deactivated := 0
	var results []models.Alumni

	for _, studentID := range studentIDs {
		studentID = strings.TrimSpace(studentID)
		if studentID == "" {
			continue
		}

		var fullName, nisn, nis, nik, gender, bp, bd, rel, addr string
		var fName, fNik, fEdu, fJob, mName, mNik, mEdu, mJob string
		var gName, gNik, gJob string
		var pn, pp *string
		var className string
		var classID string
		var photo sql.NullString
		var crAtInt sql.NullInt64

		var nullClassName, nullClassID sql.NullString
		row := tx.QueryRow(`
			SELECT id, full_name, nisn, nis, nik, gender, birth_place, birth_date,
			       COALESCE(religion,''), COALESCE(address,''),
			       COALESCE(father_name,''), COALESCE(father_nik,''), COALESCE(father_education,''), COALESCE(father_job,''),
			       COALESCE(mother_name,''), COALESCE(mother_nik,''), COALESCE(mother_education,''), COALESCE(mother_job,''),
			       COALESCE(guardian_name,''), COALESCE(guardian_nik,''), COALESCE(guardian_job,''),
			       COALESCE(parent_name,''), COALESCE(parent_phone,''), class_name, class_id, photo, created_at
			FROM students WHERE id = ?`, studentID)

		var nullablePN, nullablePP, nullablePhoto, nullableCrAt sql.NullString
		var nullableNIK sql.NullString
		err := row.Scan(&studentID, &fullName, &nisn, &nis, &nullableNIK, &gender, &bp, &bd,
			&rel, &addr,
			&fName, &fNik, &fEdu, &fJob,
			&mName, &mNik, &mEdu, &mJob,
			&gName, &gNik, &gJob,
			&nullablePN, &nullablePP, &nullClassName, &nullClassID, &nullablePhoto, &nullableCrAt)
		if nullClassName.Valid {
			className = nullClassName.String
		}
		if nullClassID.Valid {
			classID = nullClassID.String
		}
		nik = nullableNIK.String
		// Use class_name directly; null is handled by FinalClass later
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, created, deactivated, fmt.Errorf("siswa tidak ditemukan: %s", studentID)
			}
			return nil, created, deactivated, err
		}

		if nullablePN.Valid { pn = &nullablePN.String }
		if nullablePP.Valid { pp = &nullablePP.String }
		if nullablePhoto.Valid { photo = nullablePhoto }
		if nullableCrAt.Valid {
			fmt.Sscanf(nullableCrAt.String, "%d", &crAtInt.Int64)
		}

		var prevSch sql.NullString
		tx.QueryRow(`SELECT previous_school FROM spmb_registrants WHERE registration_number = ? OR student_nik = ? LIMIT 1`,
			optionalString(sql.NullString{String: nis, Valid: nis != ""}), optionalString(sql.NullString{String: nik, Valid: nik != ""})).Scan(&prevSch)

		var enrolledYear *string
		if crAtInt.Valid && crAtInt.Int64 > 0 {
			t := time.UnixMilli(crAtInt.Int64)
			y := fmt.Sprintf("%d", t.Year())
			enrolledYear = &y
		}

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

		var existingID string
		checkArgs := []interface{}{studentID}
		checkQuery := "SELECT id FROM alumni WHERE student_id = ?"
		if nisn != "" {
			checkQuery += " OR nisn = ?"
			checkArgs = append(checkArgs, nisn)
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
				optionalString(sql.NullString{String: nisn, Valid: nisn != ""}),
				optionalString(sql.NullString{String: nis, Valid: nis != ""}),
				fullName,
				optionalString(sql.NullString{String: gender, Valid: gender != ""}),
				optionalString(sql.NullString{String: bp, Valid: bp != ""}),
				optionalString(sql.NullString{String: bd, Valid: bd != ""}),
				graduationYear, gd.UnixMilli(),
				optionalString(sql.NullString{String: className, Valid: className != ""}),
				optionalString(sql.NullString{String: photo.String, Valid: photo.Valid}),
				optionalString(sql.NullString{String: *pn, Valid: pn != nil}),
				optionalString(sql.NullString{String: *pp, Valid: pp != nil}),
				optionalString(sql.NullString{String: addr, Valid: addr != ""}), nil,
				optionalString(sql.NullString{String: nik, Valid: nik != ""}),
				optionalString(sql.NullString{String: rel, Valid: rel != ""}),
				optionalString(sql.NullString{String: addr, Valid: addr != ""}),
				enrolledYear,
				optionalString(prevSch),
				optionalString(sql.NullString{String: fName, Valid: fName != ""}),
				optionalString(sql.NullString{String: fNik, Valid: fNik != ""}),
				optionalString(sql.NullString{String: fEdu, Valid: fEdu != ""}),
				optionalString(sql.NullString{String: fJob, Valid: fJob != ""}),
				optionalString(sql.NullString{String: mName, Valid: mName != ""}),
				optionalString(sql.NullString{String: mNik, Valid: mNik != ""}),
				optionalString(sql.NullString{String: mEdu, Valid: mEdu != ""}),
				optionalString(sql.NullString{String: mJob, Valid: mJob != ""}),
				optionalString(sql.NullString{String: gName, Valid: gName != ""}),
				optionalString(sql.NullString{String: gNik, Valid: gNik != ""}),
				optionalString(sql.NullString{String: gJob, Valid: gJob != ""}),
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
			clear, reason, err := CheckStudentClearance(tx, studentID)
			if err != nil {
				return nil, created, deactivated, err
			}
			if !clear {
				var name string
				_ = tx.QueryRow("SELECT full_name FROM students WHERE id = ?", studentID).Scan(&name)
				return nil, created, deactivated, fmt.Errorf("Gagal meluluskan %s: %s", name, reason)
			}

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
			historyID, studentID, optionalString(sql.NullString{String: classID, Valid: classID != ""}), optionalString(sql.NullString{String: className, Valid: className != ""}), graduationYear, "graduated", now)

		alumni := models.Alumni{
			ID:             alumniID,
			StudentID:      &studentID,
			NISN:           optionalString(sql.NullString{String: nisn, Valid: nisn != ""}),
			NIS:            optionalString(sql.NullString{String: nis, Valid: nis != ""}),
			NIK:            optionalString(sql.NullString{String: nik, Valid: nik != ""}),
			FullName:       fullName,
			Gender:         optionalString(sql.NullString{String: gender, Valid: gender != ""}),
			BirthPlace:     optionalString(sql.NullString{String: bp, Valid: bp != ""}),
			BirthDate:      optionalString(sql.NullString{String: bd, Valid: bd != ""}),
			Religion:       optionalString(sql.NullString{String: rel, Valid: rel != ""}),
			Address:        optionalString(sql.NullString{String: addr, Valid: addr != ""}),
			EnrolledYear:   enrolledYear,
			PreviousSchool: optionalString(prevSch),
			GraduationYear: graduationYear,
			GraduationDate: &gd,
			FinalClass:     			optionalString(sql.NullString{String: className, Valid: className != ""}),
			Photo:          optionalString(sql.NullString{String: photo.String, Valid: photo.Valid}),
			ParentName:     optionalString(sql.NullString{String: *pn, Valid: pn != nil}),
			ParentPhone:    optionalString(sql.NullString{String: *pp, Valid: pp != nil}),
			CurrentAddress: optionalString(sql.NullString{String: addr, Valid: addr != ""}),
			FatherName:     optionalString(sql.NullString{String: fName, Valid: fName != ""}),
			FatherNIK:      optionalString(sql.NullString{String: fNik, Valid: fNik != ""}),
			FatherEducation: optionalString(sql.NullString{String: fEdu, Valid: fEdu != ""}),
			FatherJob:      optionalString(sql.NullString{String: fJob, Valid: fJob != ""}),
			MotherName:     optionalString(sql.NullString{String: mName, Valid: mName != ""}),
			MotherNIK:      optionalString(sql.NullString{String: mNik, Valid: mNik != ""}),
			MotherEducation: optionalString(sql.NullString{String: mEdu, Valid: mEdu != ""}),
			MotherJob:      optionalString(sql.NullString{String: mJob, Valid: mJob != ""}),
			GuardianName:   optionalString(sql.NullString{String: gName, Valid: gName != ""}),
			GuardianNIK:    optionalString(sql.NullString{String: gNik, Valid: gNik != ""}),
			GuardianJob:    optionalString(sql.NullString{String: gJob, Valid: gJob != ""}),
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