package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// TugasRepository mengelola modul Tugas & PR (guru → siswa).
type TugasRepository struct {
	DB *sql.DB
}

func NewTugasRepository(db *sql.DB) *TugasRepository {
	return &TugasRepository{DB: db}
}

func (r *TugasRepository) genID() string {
	return cuid2.Generate()
}

// nullIfEmpty & rowScanner dideklarasikan di inventory_repo.go (dipakai bersama).

const tugasColumns = `
	t.id, t.teacher_user_id, u.name, t.class_id, t.class_name,
	t.subject_id, t.subject_name, t.academic_year, t.title, t.description,
	t.attachment_url, t.attachment_name, t.due_at, t.allow_late, t.status,
	t.created_at, t.updated_at
`

// scanTugas memindai 17 kolom dasar sebuah tugas.
func scanTugas(row rowScanner) (*models.Tugas, error) {
	var t models.Tugas
	var teacherName, className, subjectID, subjectName, academicYear,
		description, attachmentURL, attachmentName sql.NullString
	var dueAt sql.NullInt64
	var allowLate int
	if err := row.Scan(
		&t.ID, &t.TeacherUserID, &teacherName, &t.ClassID, &className,
		&subjectID, &subjectName, &academicYear, &t.Title, &description,
		&attachmentURL, &attachmentName, &dueAt, &allowLate, &t.Status,
		&t.CreatedAt, &t.UpdatedAt,
	); err != nil {
		return nil, err
	}
	t.TeacherName = teacherName.String
	t.ClassName = className.String
	t.SubjectID = subjectID.String
	t.SubjectName = subjectName.String
	t.AcademicYear = academicYear.String
	t.Description = description.String
	t.AttachmentURL = attachmentURL.String
	t.AttachmentName = attachmentName.String
	if dueAt.Valid {
		d := dueAt.Int64
		t.DueAt = &d
	}
	t.AllowLate = allowLate == 1
	return &t, nil
}

// scanTugasWithStats memindai kolom dasar + 3 agregat pengumpulan (view guru).
func scanTugasWithStats(row rowScanner) (*models.Tugas, error) {
	var t models.Tugas
	var teacherName, className, subjectID, subjectName, academicYear,
		description, attachmentURL, attachmentName sql.NullString
	var dueAt sql.NullInt64
	var allowLate int
	if err := row.Scan(
		&t.ID, &t.TeacherUserID, &teacherName, &t.ClassID, &className,
		&subjectID, &subjectName, &academicYear, &t.Title, &description,
		&attachmentURL, &attachmentName, &dueAt, &allowLate, &t.Status,
		&t.CreatedAt, &t.UpdatedAt,
		&t.TotalStudents, &t.SubmittedCount, &t.GradedCount,
	); err != nil {
		return nil, err
	}
	t.TeacherName = teacherName.String
	t.ClassName = className.String
	t.SubjectID = subjectID.String
	t.SubjectName = subjectName.String
	t.AcademicYear = academicYear.String
	t.Description = description.String
	t.AttachmentURL = attachmentURL.String
	t.AttachmentName = attachmentName.String
	if dueAt.Valid {
		d := dueAt.Int64
		t.DueAt = &d
	}
	t.AllowLate = allowLate == 1
	return &t, nil
}

// scanMyTugas memindai kolom dasar + status pengumpulan siswa yang login.
// myColumns wajib berupa 9 kolom: my.id, my.submitted_at, my.is_late,
// my.score, my.status, my.answer_text, my.attachment_url,
// my.attachment_name, my.feedback.
func scanMyTugas(row rowScanner) (*models.Tugas, error) {
	var t models.Tugas
	var teacherName, className, subjectID, subjectName, academicYear,
		description, attachmentURL, attachmentName, myID, myStatus,
		myAnswer, myAttachmentURL, myAttachmentName, myFeedback sql.NullString
	var dueAt, mySubmittedAt sql.NullInt64
	var allowLate int
	var myIsLate sql.NullInt64
	var myScore sql.NullFloat64
	if err := row.Scan(
		&t.ID, &t.TeacherUserID, &teacherName, &t.ClassID, &className,
		&subjectID, &subjectName, &academicYear, &t.Title, &description,
		&attachmentURL, &attachmentName, &dueAt, &allowLate, &t.Status,
		&t.CreatedAt, &t.UpdatedAt,
		&myID, &mySubmittedAt, &myIsLate, &myScore, &myStatus,
		&myAnswer, &myAttachmentURL, &myAttachmentName, &myFeedback,
	); err != nil {
		return nil, err
	}
	t.TeacherName = teacherName.String
	t.ClassName = className.String
	t.SubjectID = subjectID.String
	t.SubjectName = subjectName.String
	t.AcademicYear = academicYear.String
	t.Description = description.String
	t.AttachmentURL = attachmentURL.String
	t.AttachmentName = attachmentName.String
	if dueAt.Valid {
		d := dueAt.Int64
		t.DueAt = &d
	}
	t.AllowLate = allowLate == 1
	if myID.Valid {
		t.MySubmissionID = myID.String
		t.MyStatus = myStatus.String
		t.MyIsLate = myIsLate.Valid && myIsLate.Int64 == 1
		t.MyAnswerText = myAnswer.String
		t.MyAttachmentURL = myAttachmentURL.String
		t.MyAttachmentName = myAttachmentName.String
		t.MyFeedback = myFeedback.String
		if mySubmittedAt.Valid {
			v := mySubmittedAt.Int64
			t.MySubmittedAt = &v
		}
		if myScore.Valid {
			v := myScore.Float64
			t.MyScore = &v
		}
	}
	return &t, nil
}

const myColumns = `my.id, my.submitted_at, my.is_late, my.score, my.status,
	my.answer_text, my.attachment_url, my.attachment_name, my.feedback`

// ══════════════════════════════════════════════════════════
// GURU / STAFF
// ══════════════════════════════════════════════════════════

// CreateTugas menyimpan tugas baru. ID & cap waktu diisi di sini.
func (r *TugasRepository) CreateTugas(t *models.Tugas) (*models.Tugas, error) {
	now := UnixMilli()
	t.ID = r.genID()
	t.CreatedAt = now
	t.UpdatedAt = now
	if t.Status == "" {
		t.Status = "published"
	}
	allowLate := 0
	if t.AllowLate {
		allowLate = 1
	}
	var dueAt interface{} = nil
	if t.DueAt != nil {
		dueAt = *t.DueAt
	}
	_, err := r.DB.Exec(`
		INSERT INTO tugas (id, teacher_user_id, class_id, class_name, subject_id,
		                   subject_name, academic_year, title, description,
		                   attachment_url, attachment_name, due_at, allow_late,
		                   status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, t.ID, t.TeacherUserID, t.ClassID, nullIfEmpty(t.ClassName),
		nullIfEmpty(t.SubjectID), nullIfEmpty(t.SubjectName),
		nullIfEmpty(t.AcademicYear), t.Title, nullIfEmpty(t.Description),
		nullIfEmpty(t.AttachmentURL), nullIfEmpty(t.AttachmentName),
		dueAt, allowLate, t.Status, now, now)
	if err != nil {
		return nil, err
	}
	return r.GetTugas(t.ID)
}

// GetTugas mengambil satu tugas + agregat pengumpulannya.
func (r *TugasRepository) GetTugas(id string) (*models.Tugas, error) {
	query := fmt.Sprintf(`
		SELECT %s,
		       (SELECT COUNT(*) FROM students s
		         WHERE s.class_id = t.class_id AND (s.is_active = 1 OR s.status = 'active')),
		       (SELECT COUNT(*) FROM tugas_submissions sub
		         WHERE sub.tugas_id = t.id AND sub.deleted_at IS NULL),
		       (SELECT COUNT(*) FROM tugas_submissions sub
		         WHERE sub.tugas_id = t.id AND sub.deleted_at IS NULL AND sub.status = 'graded')
		FROM tugas t
		LEFT JOIN users u ON u.id = t.teacher_user_id
		WHERE t.id = ? AND t.deleted_at IS NULL
	`, tugasColumns)
	return scanTugasWithStats(r.DB.QueryRow(query, id))
}

// UpdateTugas memperbarui konten tugas (kelas tidak bisa diubah).
func (r *TugasRepository) UpdateTugas(t *models.Tugas) error {
	allowLate := 0
	if t.AllowLate {
		allowLate = 1
	}
	var dueAt interface{} = nil
	if t.DueAt != nil {
		dueAt = *t.DueAt
	}
	_, err := r.DB.Exec(`
		UPDATE tugas
		SET title = ?, description = ?, subject_id = ?, subject_name = ?,
		    attachment_url = ?, attachment_name = ?, due_at = ?,
		    allow_late = ?, updated_at = ?
		WHERE id = ? AND deleted_at IS NULL
	`, t.Title, nullIfEmpty(t.Description), nullIfEmpty(t.SubjectID),
		nullIfEmpty(t.SubjectName), nullIfEmpty(t.AttachmentURL),
		nullIfEmpty(t.AttachmentName), dueAt, allowLate, UnixMilli(), t.ID)
	return err
}

// SetArchived mempublish/mengarsipkan tugas tanpa menghapus datanya.
func (r *TugasRepository) SetArchived(id string, archived bool) error {
	status := "published"
	if archived {
		status = "archived"
	}
	_, err := r.DB.Exec(`UPDATE tugas SET status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
		status, UnixMilli(), id)
	return err
}

// SoftDeleteTugas menghapus tugas + pengumpulannya secara soft.
func (r *TugasRepository) SoftDeleteTugas(id string) error {
	now := UnixMilli()
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.Exec(`UPDATE tugas SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
		now, now, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE tugas_submissions SET deleted_at = ?, updated_at = ? WHERE tugas_id = ? AND deleted_at IS NULL`,
		now, now, id); err != nil {
		return err
	}
	return tx.Commit()
}

// ListTugas mengambil tugas yang terlihat oleh user (wali scope).
func (r *TugasRepository) ListTugas(teacherUserID, classID, status, search string, scopeAll bool, page, limit int) ([]models.Tugas, int, error) {
	where := []string{"t.deleted_at IS NULL"}
	args := []interface{}{}
	if !scopeAll {
		where = append(where, "t.teacher_user_id = ?")
		args = append(args, teacherUserID)
	}
	if classID != "" {
		where = append(where, "t.class_id = ?")
		args = append(args, classID)
	}
	if status != "" {
		where = append(where, "t.status = ?")
		args = append(args, status)
	}
	if search != "" {
		where = append(where, "t.title LIKE ?")
		args = append(args, "%"+search+"%")
	}
	whereClause := strings.Join(where, " AND ")

	var total int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM tugas t WHERE "+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT %s,
		       (SELECT COUNT(*) FROM students s
		         WHERE s.class_id = t.class_id AND (s.is_active = 1 OR s.status = 'active')),
		       (SELECT COUNT(*) FROM tugas_submissions sub
		         WHERE sub.tugas_id = t.id AND sub.deleted_at IS NULL),
		       (SELECT COUNT(*) FROM tugas_submissions sub
		         WHERE sub.tugas_id = t.id AND sub.deleted_at IS NULL AND sub.status = 'graded')
		FROM tugas t
		LEFT JOIN users u ON u.id = t.teacher_user_id
		WHERE %s
		ORDER BY t.created_at DESC
		LIMIT ? OFFSET ?
	`, tugasColumns, whereClause)
	rows, err := r.DB.Query(query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []models.Tugas
	for rows.Next() {
		t, err := scanTugasWithStats(rows)
		if err != nil {
			return nil, 0, err
		}
		list = append(list, *t)
	}
	return list, total, nil
}

// ListTugasRoster mengambil roster kelas tugas + status pengumpulan tiap siswa.
func (r *TugasRepository) ListTugasRoster(tugasID string) ([]models.TugasRosterItem, error) {
	rows, err := r.DB.Query(`
		SELECT s.id, s.full_name,
		       sub.id, sub.submitted_at, sub.is_late, sub.score, sub.status, sub.feedback
		FROM tugas t
		JOIN students s ON s.class_id = t.class_id AND (s.is_active = 1 OR s.status = 'active')
		LEFT JOIN tugas_submissions sub
		       ON sub.tugas_id = t.id AND sub.student_id = s.id AND sub.deleted_at IS NULL
		WHERE t.id = ? AND t.deleted_at IS NULL
		ORDER BY s.full_name ASC
	`, tugasID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.TugasRosterItem
	for rows.Next() {
		var item models.TugasRosterItem
		var subID, subStatus, subFeedback sql.NullString
		var submittedAt sql.NullInt64
		var isLate sql.NullInt64
		var score sql.NullFloat64
		if err := rows.Scan(&item.StudentID, &item.StudentName, &subID,
			&submittedAt, &isLate, &score, &subStatus, &subFeedback); err != nil {
			return nil, err
		}
		if subID.Valid {
			item.SubmissionID = subID.String
			item.Status = subStatus.String
			item.IsLate = isLate.Valid && isLate.Int64 == 1
			item.Feedback = subFeedback.String
			if submittedAt.Valid {
				v := submittedAt.Int64
				item.SubmittedAt = &v
			}
			if score.Valid {
				v := score.Float64
				item.Score = &v
			}
		}
		list = append(list, item)
	}
	return list, nil
}

// ListSubmissions mengambil semua pengumpulan sebuah tugas (view guru).
func (r *TugasRepository) ListSubmissions(tugasID string, page, limit int) ([]models.TugasSubmission, int, error) {
	var total int
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM tugas_submissions WHERE tugas_id = ? AND deleted_at IS NULL`,
		tugasID).Scan(&total); err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * limit
	rows, err := r.DB.Query(`
		SELECT sub.id, sub.tugas_id, sub.student_id, s.full_name,
		       sub.answer_text, sub.attachment_url, sub.attachment_name,
		       sub.submitted_at, sub.is_late, sub.score, sub.feedback,
		       sub.graded_by, sub.graded_at, sub.status,
		       sub.created_at, sub.updated_at
		FROM tugas_submissions sub
		JOIN students s ON s.id = sub.student_id
		WHERE sub.tugas_id = ? AND sub.deleted_at IS NULL
		ORDER BY s.full_name ASC
		LIMIT ? OFFSET ?
	`, tugasID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []models.TugasSubmission
	for rows.Next() {
		sub, err := scanSubmission(rows)
		if err != nil {
			return nil, 0, err
		}
		list = append(list, *sub)
	}
	return list, total, nil
}

// GetSubmission mengambil pengumpulan seorang siswa untuk sebuah tugas.
func (r *TugasRepository) GetSubmission(tugasID, studentID string) (*models.TugasSubmission, error) {
	return r.querySubmission(`
		SELECT sub.id, sub.tugas_id, sub.student_id, s.full_name,
		       sub.answer_text, sub.attachment_url, sub.attachment_name,
		       sub.submitted_at, sub.is_late, sub.score, sub.feedback,
		       sub.graded_by, sub.graded_at, sub.status,
		       sub.created_at, sub.updated_at
		FROM tugas_submissions sub
		JOIN students s ON s.id = sub.student_id
		WHERE sub.tugas_id = ? AND sub.student_id = ? AND sub.deleted_at IS NULL
	`, tugasID, studentID)
}

// GetSubmissionByID mengambil satu pengumpulan berdasarkan id-nya.
func (r *TugasRepository) GetSubmissionByID(subID string) (*models.TugasSubmission, error) {
	return r.querySubmission(`
		SELECT sub.id, sub.tugas_id, sub.student_id, s.full_name,
		       sub.answer_text, sub.attachment_url, sub.attachment_name,
		       sub.submitted_at, sub.is_late, sub.score, sub.feedback,
		       sub.graded_by, sub.graded_at, sub.status,
		       sub.created_at, sub.updated_at
		FROM tugas_submissions sub
		JOIN students s ON s.id = sub.student_id
		WHERE sub.id = ? AND sub.deleted_at IS NULL
	`, subID)
}

func (r *TugasRepository) querySubmission(query string, args ...interface{}) (*models.TugasSubmission, error) {
	sub, err := scanSubmission(r.DB.QueryRow(query, args...))
	if err != nil {
		return nil, err
	}
	return sub, nil
}

func scanSubmission(row rowScanner) (*models.TugasSubmission, error) {
	var sub models.TugasSubmission
	var studentName, answerText, attachmentURL, attachmentName,
		feedback, gradedBy sql.NullString
	var gradedAt sql.NullInt64
	var isLate int
	var score sql.NullFloat64
	if err := row.Scan(
		&sub.ID, &sub.TugasID, &sub.StudentID, &studentName,
		&answerText, &attachmentURL, &attachmentName,
		&sub.SubmittedAt, &isLate, &score, &feedback,
		&gradedBy, &gradedAt, &sub.Status, &sub.CreatedAt, &sub.UpdatedAt,
	); err != nil {
		return nil, err
	}
	sub.StudentName = studentName.String
	sub.AnswerText = answerText.String
	sub.AttachmentURL = attachmentURL.String
	sub.AttachmentName = attachmentName.String
	sub.Feedback = feedback.String
	sub.GradedBy = gradedBy.String
	sub.IsLate = isLate == 1
	if gradedAt.Valid {
		v := gradedAt.Int64
		sub.GradedAt = &v
	}
	if score.Valid {
		v := score.Float64
		sub.Score = &v
	}
	return &sub, nil
}

// UpsertSubmission membuat atau memperbarui pengumpulan siswa. is_late
// ditentikan pemanggil (dari due_at tugas saat pengumpulan).
func (r *TugasRepository) UpsertSubmission(tugasID, studentID, answerText, attachmentURL, attachmentName string, isLate bool) (*models.TugasSubmission, error) {
	now := UnixMilli()
	lateFlag := 0
	if isLate {
		lateFlag = 1
	}
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	var existingID string
	err = tx.QueryRow(`
		SELECT id FROM tugas_submissions
		WHERE tugas_id = ? AND student_id = ? AND deleted_at IS NULL
	`, tugasID, studentID).Scan(&existingID)

	switch {
	case err == sql.ErrNoRows:
		_, err = tx.Exec(`
			INSERT INTO tugas_submissions (id, tugas_id, student_id, answer_text,
			                               attachment_url, attachment_name,
			                               submitted_at, is_late, status,
			                               created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
		`, r.genID(), tugasID, studentID, nullIfEmpty(answerText),
			nullIfEmpty(attachmentURL), nullIfEmpty(attachmentName),
			now, lateFlag, now, now)
		if err != nil {
			return nil, err
		}
	case err == nil:
		_, err = tx.Exec(`
			UPDATE tugas_submissions
			SET answer_text = ?, attachment_url = ?, attachment_name = ?,
			    submitted_at = ?, is_late = ?, status = 'submitted', updated_at = ?
			WHERE id = ? AND deleted_at IS NULL
		`, nullIfEmpty(answerText), nullIfEmpty(attachmentURL),
			nullIfEmpty(attachmentName), now, lateFlag, now, existingID)
		if err != nil {
			return nil, err
		}
	default:
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetSubmission(tugasID, studentID)
}

// GradeSubmission menyimpan nilai & feedback, status menjadi 'graded'.
func (r *TugasRepository) GradeSubmission(subID string, score *float64, feedback, gradedBy string) error {
	now := UnixMilli()
	var scoreVal interface{} = nil
	if score != nil {
		scoreVal = *score
	}
	_, err := r.DB.Exec(`
		UPDATE tugas_submissions
		SET score = ?, feedback = ?, graded_by = ?, graded_at = ?,
		    status = 'graded', updated_at = ?
		WHERE id = ? AND deleted_at IS NULL
	`, scoreVal, nullIfEmpty(feedback), nullIfEmpty(gradedBy), now, now, subID)
	return err
}

// GetSubjectName mengambil nama mapel berdasarkan id (snapshot saat buat tugas).
func (r *TugasRepository) GetSubjectName(subjectID string) (string, error) {
	if subjectID == "" {
		return "", nil
	}
	var name string
	err := r.DB.QueryRow(`SELECT name FROM subjects WHERE id = ?`, subjectID).Scan(&name)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return name, err
}

// GetStudentClassID mengambil class_id seorang siswa.
func (r *TugasRepository) GetStudentClassID(studentID string) (string, error) {
	var classID string
	err := r.DB.QueryRow(`SELECT COALESCE(class_id, '') FROM students WHERE id = ?`, studentID).Scan(&classID)
	return classID, err
}

// ListStudentUserIDsByClass mengambil user_id siswa aktif sebuah kelas
// (untuk notifikasi tugas baru).
func (r *TugasRepository) ListStudentUserIDsByClass(classID string) ([]string, error) {
	rows, err := r.DB.Query(`
		SELECT u.id FROM users u
		JOIN students s ON s.id = u.student_id
		WHERE s.class_id = ? AND (s.is_active = 1 OR s.status = 'active')
		  AND u.is_active = 1 AND u.student_id IS NOT NULL
	`, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// ListClassParentUsers mengambil user_id orang tua dari siswa sebuah kelas.
func (r *TugasRepository) ListClassParentUsers(classID string) ([]string, error) {
	rows, err := r.DB.Query(`
		SELECT DISTINCT ps.user_id
		FROM parent_students ps
		JOIN students s ON s.id = ps.student_id
		WHERE s.class_id = ? AND ps.is_active = 1
	`, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// ListRemindTargets mengambil user_id siswa yang belum mengumpulkan sebuah
// tugas (untuk fitur "ingatkan").
func (r *TugasRepository) ListRemindTargets(tugasID, classID string) ([]string, error) {
	rows, err := r.DB.Query(`
		SELECT u.id FROM students s
		JOIN users u ON u.student_id = s.id
		WHERE s.class_id = ? AND (s.is_active = 1 OR s.status = 'active')
		  AND u.is_active = 1
		  AND NOT EXISTS (
		      SELECT 1 FROM tugas_submissions sub
		      WHERE sub.tugas_id = ? AND sub.student_id = s.id AND sub.deleted_at IS NULL
		  )
		ORDER BY s.full_name ASC
	`, classID, tugasID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// ══════════════════════════════════════════════════════════
// SISWA
// ══════════════════════════════════════════════════════════

// ListMyTugas mengambil tugas kelas siswa + status pengumpulannya sendiri.
func (r *TugasRepository) ListMyTugas(studentID, classID string, page, limit int) ([]models.Tugas, int, error) {
	where := "t.deleted_at IS NULL AND t.status = 'published' AND t.class_id = ?"
	var total int
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM tugas t WHERE `+where, classID).Scan(&total); err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT %s, %s
		FROM tugas t
		LEFT JOIN users u ON u.id = t.teacher_user_id
		LEFT JOIN tugas_submissions my
		       ON my.tugas_id = t.id AND my.student_id = ? AND my.deleted_at IS NULL
		WHERE %s
		ORDER BY (my.submitted_at IS NULL) DESC, (t.due_at IS NULL) ASC, t.due_at ASC, t.created_at DESC
		LIMIT ? OFFSET ?
	`, tugasColumns, myColumns, where)
	rows, err := r.DB.Query(query, studentID, classID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []models.Tugas
	for rows.Next() {
		t, err := scanMyTugas(rows)
		if err != nil {
			return nil, 0, err
		}
		list = append(list, *t)
	}
	return list, total, nil
}

// GetMyTugas mengambil satu tugas + pengumpulan siswa sendiri.
func (r *TugasRepository) GetMyTugas(tugasID, studentID string) (*models.Tugas, error) {
	query := fmt.Sprintf(`
		SELECT %s, %s
		FROM tugas t
		LEFT JOIN users u ON u.id = t.teacher_user_id
		LEFT JOIN tugas_submissions my
		       ON my.tugas_id = t.id AND my.student_id = ? AND my.deleted_at IS NULL
		WHERE t.id = ? AND t.deleted_at IS NULL AND t.status = 'published'
	`, tugasColumns, myColumns)
	return scanMyTugas(r.DB.QueryRow(query, studentID, tugasID))
}

// ══════════════════════════════════════════════════════════
// ORANG TUA
// ══════════════════════════════════════════════════════════

// ListChildrenTugas mengambil tugas semua anak orang tua + status pengumpulan
// masing-masing. studentID kosong = semua anak.
func (r *TugasRepository) ListChildrenTugas(parentUserID, studentID string, page, limit int) ([]models.Tugas, int, error) {
	// args pertama selalu untuk JOIN ps.user_id = ?; filter tambahan disusun
	// terpisah agar count & list mendapat jumlah placeholder yang sama.
	baseWhere := "t.deleted_at IS NULL AND t.status = 'published' AND ps.is_active = 1"
	args := []interface{}{parentUserID}
	if studentID != "" {
		baseWhere += " AND ps.student_id = ?"
		args = append(args, studentID)
	}

	var total int
	if err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM tugas t
		JOIN parent_students ps ON ps.user_id = ? AND ps.is_active = 1
		JOIN students s ON s.id = ps.student_id AND s.class_id = t.class_id
		WHERE `+baseWhere, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT %s, s.id, s.full_name, %s
		FROM tugas t
		JOIN parent_students ps ON ps.user_id = ? AND ps.is_active = 1
		JOIN students s ON s.id = ps.student_id AND s.class_id = t.class_id
		LEFT JOIN users u ON u.id = t.teacher_user_id
		LEFT JOIN tugas_submissions my
		       ON my.tugas_id = t.id AND my.student_id = s.id AND my.deleted_at IS NULL
		WHERE %s
		ORDER BY (my.submitted_at IS NULL) DESC, (t.due_at IS NULL) ASC, t.due_at ASC, t.created_at DESC
		LIMIT ? OFFSET ?
	`, tugasColumns, myColumns, baseWhere)
	rows, err := r.DB.Query(query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []models.Tugas
	for rows.Next() {
		var t models.Tugas
		var teacherName, className, subjectID, subjectName, academicYear,
			description, attachmentURL, attachmentName, myID, myStatus,
			myAnswer, myAttachmentURL, myAttachmentName, myFeedback sql.NullString
		var dueAt, mySubmittedAt sql.NullInt64
		var allowLate int
		var myIsLate sql.NullInt64
		var myScore sql.NullFloat64
		if err := rows.Scan(
			&t.ID, &t.TeacherUserID, &teacherName, &t.ClassID, &className,
			&subjectID, &subjectName, &academicYear, &t.Title, &description,
			&attachmentURL, &attachmentName, &dueAt, &allowLate, &t.Status,
			&t.CreatedAt, &t.UpdatedAt,
			&t.StudentID, &t.StudentName,
			&myID, &mySubmittedAt, &myIsLate, &myScore, &myStatus,
			&myAnswer, &myAttachmentURL, &myAttachmentName, &myFeedback,
		); err != nil {
			return nil, 0, err
		}
		t.TeacherName = teacherName.String
		t.ClassName = className.String
		t.SubjectID = subjectID.String
		t.SubjectName = subjectName.String
		t.AcademicYear = academicYear.String
		t.Description = description.String
		t.AttachmentURL = attachmentURL.String
		t.AttachmentName = attachmentName.String
		if dueAt.Valid {
			d := dueAt.Int64
			t.DueAt = &d
		}
		t.AllowLate = allowLate == 1
		if myID.Valid {
			t.MySubmissionID = myID.String
			t.MyStatus = myStatus.String
			t.MyIsLate = myIsLate.Valid && myIsLate.Int64 == 1
			t.MyAnswerText = myAnswer.String
			t.MyAttachmentURL = myAttachmentURL.String
			t.MyAttachmentName = myAttachmentName.String
			t.MyFeedback = myFeedback.String
			if mySubmittedAt.Valid {
				v := mySubmittedAt.Int64
				t.MySubmittedAt = &v
			}
			if myScore.Valid {
				v := myScore.Float64
				t.MyScore = &v
			}
		}
		list = append(list, t)
	}
	return list, total, nil
}
