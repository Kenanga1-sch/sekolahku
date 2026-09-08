package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

func (r *AlumniRepository) ImportBulkAlumni(alumniList []models.Alumni) (int, int, []string, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return 0, 0, nil, err
	}
	defer tx.Rollback()

	inserted := 0
	updated := 0
	var logs []string
	now := time.Now().UnixMilli()

	for idx, a := range alumniList {
		if a.FullName == "" {
			logs = append(logs, fmt.Sprintf("Baris %d: Nama Lengkap kosong, dilewati", idx+1))
			continue
		}

		var existingID string
		var queryStr string
		var queryArg interface{}

		if a.NISN != nil && *a.NISN != "" {
			queryStr = "SELECT id FROM alumni WHERE nisn = ?"
			queryArg = *a.NISN
		} else if a.NIS != nil && *a.NIS != "" {
			queryStr = "SELECT id FROM alumni WHERE nis = ?"
			queryArg = *a.NIS
		} else if a.NIK != nil && *a.NIK != "" {
			queryStr = "SELECT id FROM alumni WHERE nik = ?"
			queryArg = *a.NIK
		} else {
			queryStr = "SELECT id FROM alumni WHERE LOWER(full_name) = LOWER(?)"
			queryArg = a.FullName
		}

		err := tx.QueryRow(queryStr, queryArg).Scan(&existingID)
		if err != nil && err != sql.ErrNoRows {
			logs = append(logs, fmt.Sprintf("Baris %d (%s): Gagal mencari data existing - %v", idx+1, a.FullName, err))
			continue
		}

		if existingID != "" {
			statusVal := a.Status
			if statusVal == "" {
				statusVal = "active"
			}
			_, err = tx.Exec(`
				UPDATE alumni SET
					nisn=COALESCE(?, nisn), nis=COALESCE(?, nis), full_name=?, gender=COALESCE(?, gender),
					birth_place=COALESCE(?, birth_place), birth_date=COALESCE(?, birth_date),
					graduation_year=COALESCE(?, graduation_year), graduation_date=COALESCE(?, graduation_date),
					final_class=COALESCE(?, final_class), parent_name=COALESCE(?, parent_name),
					parent_phone=COALESCE(?, parent_phone), current_address=COALESCE(?, current_address),
					current_phone=COALESCE(?, current_phone), current_email=COALESCE(?, current_email),
					next_school=COALESCE(?, next_school), notes=COALESCE(?, notes),
					nik=COALESCE(?, nik), religion=COALESCE(?, religion), address=COALESCE(?, address),
					enrolled_year=COALESCE(?, enrolled_year), previous_school=COALESCE(?, previous_school),
					father_name=COALESCE(?, father_name), father_nik=COALESCE(?, father_nik),
					father_education=COALESCE(?, father_education), father_job=COALESCE(?, father_job),
					mother_name=COALESCE(?, mother_name), mother_nik=COALESCE(?, mother_nik),
					mother_education=COALESCE(?, mother_education), mother_job=COALESCE(?, mother_job),
					guardian_name=COALESCE(?, guardian_name), guardian_nik=COALESCE(?, guardian_nik),
					guardian_relation=COALESCE(?, guardian_relation), guardian_job=COALESCE(?, guardian_job),
					guardian_phone=COALESCE(?, guardian_phone), sibling_count=COALESCE(?, sibling_count),
					child_order=COALESCE(?, child_order), height=COALESCE(?, height), weight=COALESCE(?, weight),
					blood_type=COALESCE(?, blood_type), medical_notes=COALESCE(?, medical_notes),
					special_needs=COALESCE(?, special_needs), current_occupation=COALESCE(?, current_occupation),
					current_institution=COALESCE(?, current_institution), last_education_level=COALESCE(?, last_education_level),
					status=?, updated_at=?,
					nickname=COALESCE(?, nickname), citizenship=COALESCE(?, citizenship),
					sibling_kandung=?, sibling_tiri=?, sibling_angkat=?,
					daily_language=COALESCE(?, daily_language), living_with=COALESCE(?, living_with),
					guardian_education=COALESCE(?, guardian_education), previous_school_address=COALESCE(?, previous_school_address),
					previous_school_cert_no=COALESCE(?, previous_school_cert_no), previous_school_cert_date=COALESCE(?, previous_school_cert_date),
					mutasi_masuk_asal_sekolah=COALESCE(?, mutasi_masuk_asal_sekolah), mutasi_masuk_dari_kelas=COALESCE(?, mutasi_masuk_dari_kelas),
					mutasi_masuk_diterima_tanggal=COALESCE(?, mutasi_masuk_diterima_tanggal), mutasi_masuk_di_kelas=COALESCE(?, mutasi_masuk_di_kelas),
					scholarship_info=COALESCE(?, scholarship_info), mutation_out_class=COALESCE(?, mutation_out_class),
				mutation_out_to_school=COALESCE(?, mutation_out_to_school), mutation_out_to_class=COALESCE(?, mutation_out_to_class),
				mutation_out_date=COALESCE(?, mutation_out_date), dropped_out_date=COALESCE(?, dropped_out_date),
				dropped_out_reason=COALESCE(?, dropped_out_reason),
				buku_fisik_no=COALESCE(?, buku_fisik_no), register_no=COALESCE(?, register_no)
			WHERE id=?
			`, a.NISN, a.NIS, a.FullName, a.Gender,
				a.BirthPlace, a.BirthDate,
				a.GraduationYear, timeToUnixMilli(a.GraduationDate),
				a.FinalClass, a.ParentName,
				a.ParentPhone, a.CurrentAddress,
				a.CurrentPhone, a.CurrentEmail,
				a.NextSchool, a.Notes,
				a.NIK, a.Religion, a.Address,
				a.EnrolledYear, a.PreviousSchool,
				a.FatherName, a.FatherNIK,
				a.FatherEducation, a.FatherJob,
				a.MotherName, a.MotherNIK,
				a.MotherEducation, a.MotherJob,
				a.GuardianName, a.GuardianNIK,
				a.GuardianRel, a.GuardianJob, a.GuardianPhone,
				a.SiblingCount, a.ChildOrder, a.Height, a.Weight,
				a.BloodType, a.MedicalN, a.SpecialN, a.CurrentOccupation,
				a.CurrentInst, a.LastEduLevel,
				statusVal, now,
				a.Nickname, a.Citizenship,
				a.SiblingKandung, a.SiblingTiri, a.SiblingAngkat,
				a.DailyLanguage, a.LivingWith, a.GuardianEducation, a.PreviousSchoolAddress,
				a.PreviousSchoolCertNo, a.PreviousSchoolCertDate,
				a.MutasiMasukAsalSekolah, a.MutasiMasukDariKelas, a.MutasiMasukDiterimaTanggal, a.MutasiMasukDiKelas,
				a.ScholarshipInfo, a.MutationOutClass, a.MutationOutToSchool, a.MutationOutToClass, a.MutationOutDate,
				a.DroppedOutDate, a.DroppedOutReason,
				a.BukuFisikNo, a.RegisterNo,
				existingID,
			)
			if err != nil {
				logs = append(logs, fmt.Sprintf("Baris %d (%s): Gagal update - %v", idx+1, a.FullName, err))
				continue
			}
			updated++
		} else {
			id := cuid2.Generate()
			statusVal := a.Status
			if statusVal == "" {
				statusVal = "active"
			}
			_, err = tx.Exec(`
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
				buku_fisik_no, register_no
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
			          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
			          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
			          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
				a.BukuFisikNo, a.RegisterNo,
			)
			if err != nil {
				logs = append(logs, fmt.Sprintf("Baris %d (%s): Gagal insert - %v", idx+1, a.FullName, err))
				continue
			}
			inserted++
		}
	}

	err = tx.Commit()
	if err != nil {
		return 0, 0, nil, err
	}

	return inserted, updated, logs, nil
}

func (r *AlumniRepository) ImportBulkGrades(gradesList []models.ImportGradeRow) (int, int, []string, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return 0, 0, nil, err
	}
	defer tx.Rollback()

	inserted := 0
	updated := 0
	var logs []string
	now := time.Now().UnixMilli()

	studentCache := make(map[string]string)

	for idx, g := range gradesList {
		if g.FullName == "" && g.NISN == "" && g.NIS == "" {
			logs = append(logs, fmt.Sprintf("Baris %d: Identitas siswa kosong, dilewati", idx+1))
			continue
		}
		if g.AcademicYear == "" || g.Semester == "" || g.SubjectName == "" {
			logs = append(logs, fmt.Sprintf("Baris %d: Tahun ajaran, semester, atau mata pelajaran kosong, dilewati", idx+1))
			continue
		}

		cacheKey := fmt.Sprintf("%s|%s|%s", g.NISN, g.NIS, g.FullName)
		alumniID, found := studentCache[cacheKey]
		if !found {
			var queryStr string
			var queryArg interface{}

			if g.NISN != "" {
				queryStr = "SELECT id FROM alumni WHERE nisn = ?"
				queryArg = g.NISN
			} else if g.NIS != "" {
				queryStr = "SELECT id FROM alumni WHERE nis = ?"
				queryArg = g.NIS
			} else {
				queryStr = "SELECT id FROM alumni WHERE LOWER(full_name) = LOWER(?)"
				queryArg = g.FullName
			}

			err := tx.QueryRow(queryStr, queryArg).Scan(&alumniID)
			if err != nil {
				if err == sql.ErrNoRows {
					logs = append(logs, fmt.Sprintf("Baris %d: Siswa '%s' (NISN: %s, NIS: %s) tidak ditemukan di Buku Induk", idx+1, g.FullName, g.NISN, g.NIS))
					continue
				}
				logs = append(logs, fmt.Sprintf("Baris %d: Gagal mencari siswa - %v", idx+1, err))
				continue
			}
			studentCache[cacheKey] = alumniID
		}

		var transcriptID string
		err = tx.QueryRow(`
			SELECT id FROM alumni_transcripts 
			WHERE alumni_id = ? AND academic_year = ? AND semester = ? AND subject_name = ?
		`, alumniID, g.AcademicYear, g.Semester, g.SubjectName).Scan(&transcriptID)

		if err != nil && err != sql.ErrNoRows {
			logs = append(logs, fmt.Sprintf("Baris %d: Gagal memeriksa nilai existing - %v", idx+1, err))
			continue
		}

		scoreLetter := scoreToLetter(g.Score)

		if transcriptID != "" {
			_, err = tx.Exec(`
				UPDATE alumni_transcripts 
				SET score = ?, score_letter = ?, notes = ?, updated_at = ? 
				WHERE id = ?
			`, g.Score, scoreLetter, g.Notes, now, transcriptID)
			if err != nil {
				logs = append(logs, fmt.Sprintf("Baris %d: Gagal update nilai - %v", idx+1, err))
				continue
			}
			updated++
		} else {
			newTransID := cuid2.Generate()
			_, err = tx.Exec(`
				INSERT INTO alumni_transcripts (id, alumni_id, academic_year, semester, subject_name, subject_code, score, score_letter, notes, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, newTransID, alumniID, g.AcademicYear, g.Semester, g.SubjectName, g.SubjectCode, g.Score, scoreLetter, g.Notes, now, now)
			if err != nil {
				logs = append(logs, fmt.Sprintf("Baris %d: Gagal insert nilai - %v", idx+1, err))
				continue
			}
			inserted++
		}
	}

	err = tx.Commit()
	if err != nil {
		return 0, 0, nil, err
	}

	return inserted, updated, logs, nil
}
