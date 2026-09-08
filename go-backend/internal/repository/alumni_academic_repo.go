package repository

import (
	"database/sql"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

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

// GetAlumniIDByStudentID returns the linked alumni (Buku Induk) record id for a student,
// or "" when the student has no buku induk record yet.
func (r *AlumniRepository) GetAlumniIDByStudentID(studentID string) (string, error) {
	var alumniID string
	err := r.DB.QueryRow(`SELECT id FROM alumni WHERE student_id = ?`, studentID).Scan(&alumniID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	return alumniID, nil
}

// GetTranscriptsByStudentID fetches transcripts via the student's linked alumni record.
// Returns an empty slice (not an error) when the student has no alumni/buku-induk record yet.
func (r *AlumniRepository) GetTranscriptsByStudentID(studentID string) ([]models.AlumniTranscript, error) {
	var alumniID string
	err := r.DB.QueryRow(`SELECT id FROM alumni WHERE student_id = ?`, studentID).Scan(&alumniID)
	if err != nil {
		if err == sql.ErrNoRows {
			return []models.AlumniTranscript{}, nil
		}
		return nil, err
	}
	return r.GetTranscripts(alumniID)
}

// GetHealthRecordsByStudentID fetches health records via the student's linked alumni record.
// Returns an empty slice (not an error) when the student has no alumni/buku-induk record yet.
func (r *AlumniRepository) GetHealthRecordsByStudentID(studentID string) ([]models.AlumniHealthRecord, error) {
	var alumniID string
	err := r.DB.QueryRow(`SELECT id FROM alumni WHERE student_id = ?`, studentID).Scan(&alumniID)
	if err != nil {
		if err == sql.ErrNoRows {
			return []models.AlumniHealthRecord{}, nil
		}
		return nil, err
	}
	return r.GetHealthRecords(alumniID)
}

// GetAttendanceByStudentID fetches attendance summaries via the student's linked alumni record.
// Returns an empty slice (not an error) when the student has no alumni/buku-induk record yet.
func (r *AlumniRepository) GetAttendanceByStudentID(studentID string) ([]models.AlumniAttendanceSummary, error) {
	var alumniID string
	err := r.DB.QueryRow(`SELECT id FROM alumni WHERE student_id = ?`, studentID).Scan(&alumniID)
	if err != nil {
		if err == sql.ErrNoRows {
			return []models.AlumniAttendanceSummary{}, nil
		}
		return nil, err
	}
	return r.GetAttendanceSummaries(alumniID)
}

// GetClassHistoryByStudentID returns class history for a student id
// (riwayat naik kelas tersimpan per student_id, bukan alumni id).
func (r *AlumniRepository) GetClassHistoryByStudentID(studentID string) ([]models.ClassHistoryEntry, error) {
	return r.GetClassHistory(studentID)
}

func (r *AlumniRepository) CreateTranscript(t models.AlumniTranscript) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`INSERT INTO alumni_transcripts (id, alumni_id, academic_year, semester, subject_name, subject_code, score, score_letter, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, t.AlumniID, t.AcYear, t.Semester, t.SubjectName, t.SubjectCode, t.Score, t.ScoreLetter, t.Notes, now, now)
	return id, err
}

func (r *AlumniRepository) UpdateTranscript(id string, t models.AlumniTranscript) error {
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`UPDATE alumni_transcripts SET academic_year=?, semester=?, subject_name=?, subject_code=?, score=?, score_letter=?, notes=?, updated_at=? WHERE id=?`,
		t.AcYear, t.Semester, t.SubjectName, t.SubjectCode, t.Score, t.ScoreLetter, t.Notes, now, id)
	return err
}

func (r *AlumniRepository) DeleteTranscript(id string) error {
	_, err := r.DB.Exec("DELETE FROM alumni_transcripts WHERE id=?", id)
	return err
}

func (r *AlumniRepository) SaveTranscriptsBulk(alumniID, acYear, semester string, transcripts []models.AlumniTranscript) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec("DELETE FROM alumni_transcripts WHERE alumni_id = ? AND academic_year = ? AND semester = ?", alumniID, acYear, semester)
	if err != nil {
		return err
	}

	now := time.Now().UnixMilli()
	stmt, err := tx.Prepare(`INSERT INTO alumni_transcripts (id, alumni_id, academic_year, semester, subject_name, subject_code, score, score_letter, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, t := range transcripts {
		id := cuid2.Generate()
		_, err = stmt.Exec(id, alumniID, acYear, semester, t.SubjectName, t.SubjectCode, t.Score, t.ScoreLetter, t.Notes, now, now)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
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

func (r *AlumniRepository) CreateAttendanceSummary(s models.AlumniAttendanceSummary) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	totalDays := s.Present + s.Sick + s.Permission + s.Absent
	_, err := r.DB.Exec(`INSERT INTO alumni_attendance_summary (id, alumni_id, academic_year, semester, present, sick, permission, absent, total_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, s.AlumniID, s.AcYear, s.Semester, s.Present, s.Sick, s.Permission, s.Absent, totalDays, now, now)
	return id, err
}

func (r *AlumniRepository) UpdateAttendanceSummary(id string, s models.AlumniAttendanceSummary) error {
	now := time.Now().UnixMilli()
	totalDays := s.Present + s.Sick + s.Permission + s.Absent
	_, err := r.DB.Exec(`UPDATE alumni_attendance_summary SET academic_year=?, semester=?, present=?, sick=?, permission=?, absent=?, total_days=?, updated_at=? WHERE id=?`,
		s.AcYear, s.Semester, s.Present, s.Sick, s.Permission, s.Absent, totalDays, now, id)
	return err
}

func (r *AlumniRepository) DeleteAttendanceSummary(id string) error {
	_, err := r.DB.Exec("DELETE FROM alumni_attendance_summary WHERE id=?", id)
	return err
}

// ─── Health Records ───

func (r *AlumniRepository) GetHealthRecords(alumniID string) ([]models.AlumniHealthRecord, error) {
	rows, err := r.DB.Query(`SELECT id, alumni_id, year, weight, height, illness, abnormality, created_at, updated_at FROM alumni_health_records WHERE alumni_id=? ORDER BY year`, alumniID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.AlumniHealthRecord
	for rows.Next() {
		var hr models.AlumniHealthRecord
		var w, h sql.NullInt64
		var ill, abn sql.NullString
		var cr, up sql.NullInt64

		err = rows.Scan(&hr.ID, &hr.AlumniID, &hr.Year, &w, &h, &ill, &abn, &cr, &up)
		if err != nil {
			return nil, err
		}

		if w.Valid { hr.Weight = intPtr(int(w.Int64)) }
		if h.Valid { hr.Height = intPtr(int(h.Int64)) }
		hr.Illness = optionalString(ill)
		hr.Abnormality = optionalString(abn)
		hr.CreatedAt = SafeTime(cr)
		hr.UpdatedAt = SafeTime(up)

		list = append(list, hr)
	}
	if list == nil {
		list = []models.AlumniHealthRecord{}
	}
	return list, nil
}

func (r *AlumniRepository) CreateHealthRecord(hr models.AlumniHealthRecord) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	var w, h interface{}
	if hr.Weight != nil { w = *hr.Weight }
	if hr.Height != nil { h = *hr.Height }

	_, err := r.DB.Exec(`INSERT INTO alumni_health_records (id, alumni_id, year, weight, height, illness, abnormality, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, hr.AlumniID, hr.Year, w, h, hr.Illness, hr.Abnormality, now, now)
	return id, err
}

func (r *AlumniRepository) UpdateHealthRecord(id string, hr models.AlumniHealthRecord) error {
	now := time.Now().UnixMilli()

	var w, h interface{}
	if hr.Weight != nil { w = *hr.Weight }
	if hr.Height != nil { h = *hr.Height }

	_, err := r.DB.Exec(`UPDATE alumni_health_records SET year=?, weight=?, height=?, illness=?, abnormality=?, updated_at=? WHERE id=?`,
		hr.Year, w, h, hr.Illness, hr.Abnormality, now, id)
	return err
}

func (r *AlumniRepository) DeleteHealthRecord(id string) error {
	_, err := r.DB.Exec("DELETE FROM alumni_health_records WHERE id=?", id)
	return err
}
