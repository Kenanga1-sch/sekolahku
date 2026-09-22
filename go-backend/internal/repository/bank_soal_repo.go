package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type BankSoalRepository struct {
	DB *sql.DB
}

func NewBankSoalRepository(db *sql.DB) *BankSoalRepository {
	return &BankSoalRepository{DB: db}
}

func (r *BankSoalRepository) genID() string {
	return cuid2.Generate()
}

func nowMs() int64 {
	return time.Now().UnixMilli()
}

// msPtrToTime mengubah Unix-ms pointer (dari request JSON) jadi *time.Time.
func msPtrToTime(ms *int64) *time.Time {
	if ms == nil || *ms == 0 {
		return nil
	}
	t := time.Unix(*ms/1000, (*ms%1000)*1000000).UTC()
	return &t
}

// timeToMs mengubah *time.Time jadi sql.NullInt64 (Unix ms) untuk disimpan.
func timeToMs(t *time.Time) sql.NullInt64 {
	if t == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: t.UnixMilli(), Valid: true}
}

// ══════════════════════════════════════════════════════════
// BAB
// ══════════════════════════════════════════════════════════

func (r *BankSoalRepository) ListBabs(subjectID, classID, kurikulumID string, page, limit int) ([]models.Bab, int, error) {
	where := []string{"b.deleted_at IS NULL"}
	args := []interface{}{}

	if subjectID != "" {
		where = append(where, "b.subject_id = ?")
		args = append(args, subjectID)
	}
	if classID != "" {
		where = append(where, "(b.class_id = ? OR b.class_id IS NULL)")
		args = append(args, classID)
	}
	if kurikulumID != "" {
		where = append(where, "b.kurikulum_id = ?")
		args = append(args, kurikulumID)
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM bab b WHERE "+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT b.id, b.subject_id, b.class_id, b.title, b.description, b.order_number,
		       b.kurikulum_id, b.semester,
		       b.created_at, b.updated_at,
		       s.name AS subject_name, c.name AS class_name, k.name AS kurikulum_name
		FROM bab b
		LEFT JOIN subjects s ON b.subject_id = s.id
		LEFT JOIN student_classes c ON b.class_id = c.id
		LEFT JOIN kurikulum k ON b.kurikulum_id = k.id
		WHERE %s
		ORDER BY b.order_number ASC, b.created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	queryArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var babs []models.Bab
	for rows.Next() {
		var b models.Bab
		var subjectName, className, kurikulumName sql.NullString
		var createdAt, updatedAt sql.NullInt64
		var kurikulumIDNull, semesterNull sql.NullString
		err := rows.Scan(&b.ID, &b.SubjectID, &b.ClassID, &b.Title, &b.Description,
			&b.OrderNumber, &kurikulumIDNull, &semesterNull, &createdAt, &updatedAt,
			&subjectName, &className, &kurikulumName)
		if err != nil {
			return nil, 0, err
		}
		if subjectName.Valid {
			b.SubjectName = &subjectName.String
		}
		if className.Valid {
			b.ClassName = &className.String
		}
		if kurikulumName.Valid {
			b.KurikulumName = &kurikulumName.String
		}
		if kurikulumIDNull.Valid {
			v := kurikulumIDNull.String
			b.KurikulumID = &v
		}
		if semesterNull.Valid {
			v := semesterNull.String
			b.Semester = &v
		}
		b.CreatedAt = SafeTime(createdAt)
		b.UpdatedAt = SafeTime(updatedAt)
		babs = append(babs, b)
	}
	return babs, total, nil
}

func (r *BankSoalRepository) GetBab(id string) (*models.Bab, error) {
	var b models.Bab
	var subjectName, className, kurikulumName sql.NullString
	var createdAt, updatedAt sql.NullInt64
	var kurikulumIDNull, semesterNull sql.NullString
	err := r.DB.QueryRow(`
		SELECT b.id, b.subject_id, b.class_id, b.title, b.description, b.order_number,
		       b.kurikulum_id, b.semester,
		       b.created_at, b.updated_at,
		       s.name, c.name, k.name
		FROM bab b
		LEFT JOIN subjects s ON b.subject_id = s.id
		LEFT JOIN student_classes c ON b.class_id = c.id
		LEFT JOIN kurikulum k ON b.kurikulum_id = k.id
		WHERE b.id = ? AND b.deleted_at IS NULL
	`, id).Scan(&b.ID, &b.SubjectID, &b.ClassID, &b.Title, &b.Description,
		&b.OrderNumber, &kurikulumIDNull, &semesterNull, &createdAt, &updatedAt,
		&subjectName, &className, &kurikulumName)
	if err != nil {
		return nil, err
	}
	if subjectName.Valid {
		b.SubjectName = &subjectName.String
	}
	if className.Valid {
		b.ClassName = &className.String
	}
	if kurikulumName.Valid {
		b.KurikulumName = &kurikulumName.String
	}
	if kurikulumIDNull.Valid {
		v := kurikulumIDNull.String
		b.KurikulumID = &v
	}
	if semesterNull.Valid {
		v := semesterNull.String
		b.Semester = &v
	}
	b.CreatedAt = SafeTime(createdAt)
	b.UpdatedAt = SafeTime(updatedAt)
	return &b, nil
}

func (r *BankSoalRepository) CreateBab(req *models.CreateBabRequest, createdBy string) (*models.Bab, error) {
	id := r.genID()
	now := nowMs()

	// order_number = lanjutkan urutan terakhir pada subject yang sama,
	// supaya bab baru muncul di bawah (drag reorder mengubahnya nanti).
	var nextOrder int
	_ = r.DB.QueryRow(
		"SELECT COALESCE(MAX(order_number), 0) + 1 FROM bab WHERE subject_id = ? AND deleted_at IS NULL",
		req.SubjectID,
	).Scan(&nextOrder)

	_, err := r.DB.Exec(`
		INSERT INTO bab (id, subject_id, class_id, kurikulum_id, semester, title, description, order_number, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.SubjectID, req.ClassID, req.KurikulumID, req.Semester, req.Title, req.Description, nextOrder, now, now)
	if err != nil {
		return nil, err
	}
	return r.GetBab(id)
}

func (r *BankSoalRepository) UpdateBab(id string, req *models.UpdateBabRequest) (*models.Bab, error) {
	sets := []string{"updated_at = ?"}
	args := []interface{}{nowMs()}

	if req.SubjectID != nil {
		sets = append(sets, "subject_id = ?")
		args = append(args, *req.SubjectID)
	}
	if req.ClassID != nil {
		sets = append(sets, "class_id = ?")
		args = append(args, *req.ClassID)
	}
	if req.KurikulumID != nil {
		sets = append(sets, "kurikulum_id = ?")
		args = append(args, *req.KurikulumID)
	}
	if req.Semester != nil {
		sets = append(sets, "semester = ?")
		args = append(args, *req.Semester)
	}
	if req.Title != nil {
		sets = append(sets, "title = ?")
		args = append(args, *req.Title)
	}
	if req.Description != nil {
		sets = append(sets, "description = ?")
		args = append(args, *req.Description)
	}

	args = append(args, id)
	_, err := r.DB.Exec("UPDATE bab SET "+strings.Join(sets, ", ")+" WHERE id = ? AND deleted_at IS NULL", args...)
	if err != nil {
		return nil, err
	}
	return r.GetBab(id)
}

func (r *BankSoalRepository) DeleteBab(id string) error {
	_, err := r.DB.Exec("UPDATE bab SET deleted_at = ? WHERE id = ?", nowMs(), id)
	return err
}

// ReorderBabs menyimpan urutan bab sesuai daftar id yang diberikan.
func (r *BankSoalRepository) ReorderBabs(orderedIDs []string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("UPDATE bab SET order_number = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := nowMs()
	for i, id := range orderedIDs {
		if _, err := stmt.Exec(i+1, now, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ══════════════════════════════════════════════════════════
// QUESTION BANK
// ══════════════════════════════════════════════════════════

func (r *BankSoalRepository) ListBanks(subjectID, classID, kurikulumID, search string, page, limit int) ([]models.QuestionBank, int, error) {
	where := []string{"qb.deleted_at IS NULL"}
	args := []interface{}{}

	if subjectID != "" {
		where = append(where, "qb.subject_id = ?")
		args = append(args, subjectID)
	}
	if classID != "" {
		where = append(where, "(qb.class_id = ? OR qb.class_id IS NULL)")
		args = append(args, classID)
	}
	if kurikulumID != "" {
		where = append(where, "qb.kurikulum_id = ?")
		args = append(args, kurikulumID)
	}
	if search != "" {
		where = append(where, "qb.title LIKE ?")
		args = append(args, "%"+search+"%")
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM question_banks qb WHERE "+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT qb.id, qb.subject_id, qb.class_id, qb.bab_id, qb.kurikulum_id, qb.semester,
		       qb.title, qb.description, qb.created_by, qb.created_at, qb.updated_at,
		       s.name, c.name, bab.title, k.name,
		       (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id AND q.deleted_at IS NULL) AS question_count
		FROM question_banks qb
		LEFT JOIN subjects s ON qb.subject_id = s.id
		LEFT JOIN student_classes c ON qb.class_id = c.id
		LEFT JOIN bab ON qb.bab_id = bab.id
		LEFT JOIN kurikulum k ON qb.kurikulum_id = k.id
		WHERE %s
		ORDER BY qb.created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	queryArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var banks []models.QuestionBank
	for rows.Next() {
		var b models.QuestionBank
		var subjectName, className, babTitle, kurikulumName sql.NullString
		var createdAt, updatedAt sql.NullInt64
		var kurikulumIDNull, semesterNull sql.NullString
		err := rows.Scan(&b.ID, &b.SubjectID, &b.ClassID, &b.BabID, &kurikulumIDNull, &semesterNull,
			&b.Title, &b.Description, &b.CreatedBy, &createdAt, &updatedAt,
			&subjectName, &className, &babTitle, &kurikulumName, &b.QuestionCount)
		if err != nil {
			return nil, 0, err
		}
		if subjectName.Valid {
			b.SubjectName = &subjectName.String
		}
		if className.Valid {
			b.ClassName = &className.String
		}
		if babTitle.Valid {
			b.BabTitle = &babTitle.String
		}
		if kurikulumName.Valid {
			b.KurikulumName = &kurikulumName.String
		}
		if kurikulumIDNull.Valid {
			v := kurikulumIDNull.String
			b.KurikulumID = &v
		}
		if semesterNull.Valid {
			v := semesterNull.String
			b.Semester = &v
		}
		b.CreatedAt = SafeTime(createdAt)
		b.UpdatedAt = SafeTime(updatedAt)
		banks = append(banks, b)
	}
	return banks, total, nil
}

func (r *BankSoalRepository) GetBank(id string) (*models.QuestionBank, error) {
	var b models.QuestionBank
	var subjectName, className, babTitle, kurikulumName sql.NullString
	var createdAt, updatedAt sql.NullInt64
	var kurikulumIDNull, semesterNull sql.NullString
	err := r.DB.QueryRow(`
		SELECT qb.id, qb.subject_id, qb.class_id, qb.bab_id, qb.kurikulum_id, qb.semester,
		       qb.title, qb.description, qb.created_by, qb.created_at, qb.updated_at,
		       s.name, c.name, bab.title, k.name,
		       (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id AND q.deleted_at IS NULL)
		FROM question_banks qb
		LEFT JOIN subjects s ON qb.subject_id = s.id
		LEFT JOIN student_classes c ON qb.class_id = c.id
		LEFT JOIN bab ON qb.bab_id = bab.id
		LEFT JOIN kurikulum k ON qb.kurikulum_id = k.id
		WHERE qb.id = ? AND qb.deleted_at IS NULL
	`, id).Scan(&b.ID, &b.SubjectID, &b.ClassID, &b.BabID, &kurikulumIDNull, &semesterNull,
		&b.Title, &b.Description, &b.CreatedBy, &createdAt, &updatedAt,
		&subjectName, &className, &babTitle, &kurikulumName, &b.QuestionCount)
	if err != nil {
		return nil, err
	}
	if subjectName.Valid {
		b.SubjectName = &subjectName.String
	}
	if className.Valid {
		b.ClassName = &className.String
	}
	if babTitle.Valid {
		b.BabTitle = &babTitle.String
	}
	if kurikulumName.Valid {
		b.KurikulumName = &kurikulumName.String
	}
	if kurikulumIDNull.Valid {
		v := kurikulumIDNull.String
		b.KurikulumID = &v
	}
	if semesterNull.Valid {
		v := semesterNull.String
		b.Semester = &v
	}
	b.CreatedAt = SafeTime(createdAt)
	b.UpdatedAt = SafeTime(updatedAt)
	return &b, nil
}

func (r *BankSoalRepository) CreateBank(req *models.CreateQuestionBankRequest, createdBy string) (*models.QuestionBank, error) {
	id := r.genID()
	now := nowMs()
	_, err := r.DB.Exec(`
		INSERT INTO question_banks (id, subject_id, class_id, bab_id, kurikulum_id, semester, title, description, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.SubjectID, req.ClassID, req.BabID, req.KurikulumID, req.Semester,
		req.Title, req.Description, createdBy, now, now)
	if err != nil {
		return nil, err
	}
	return r.GetBank(id)
}

func (r *BankSoalRepository) DeleteBank(id string) error {
	_, err := r.DB.Exec("UPDATE question_banks SET deleted_at = ? WHERE id = ?", nowMs(), id)
	return err
}

// CountQuestionsInBank menghitung soal aktif (belum soft-delete) di sebuah bank.
func (r *BankSoalRepository) CountQuestionsInBank(bankID string) (int, error) {
	var count int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM questions WHERE bank_id = ? AND deleted_at IS NULL", bankID).Scan(&count)
	return count, err
}

// ══════════════════════════════════════════════════════════
// QUESTIONS
// ══════════════════════════════════════════════════════════

func (r *BankSoalRepository) ListQuestions(bankID, qType, difficulty string, page, limit int) ([]models.Question, int, error) {
	where := []string{"q.deleted_at IS NULL"}
	args := []interface{}{}

	if bankID != "" {
		where = append(where, "q.bank_id = ?")
		args = append(args, bankID)
	}
	if qType != "" {
		where = append(where, "q.type = ?")
		args = append(args, qType)
	}
	if difficulty != "" {
		where = append(where, "q.difficulty = ?")
		args = append(args, difficulty)
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM questions q WHERE "+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT id, bank_id, type, content, media_url, media_type, options, correct_answer,
		       explanation, points, order_number, difficulty, created_by, created_at, updated_at
		FROM questions q
		WHERE %s
		ORDER BY q.order_number ASC, q.created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	queryArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var questions []models.Question
	for rows.Next() {
		var q models.Question
		var createdAt, updatedAt sql.NullInt64
		err := rows.Scan(&q.ID, &q.BankID, &q.Type, &q.Content, &q.MediaURL, &q.MediaType,
			&q.Options, &q.CorrectAnswer, &q.Explanation, &q.Points, &q.OrderNumber,
			&q.Difficulty, &q.CreatedBy, &createdAt, &updatedAt)
		if err != nil {
			return nil, 0, err
		}
		q.CreatedAt = SafeTime(createdAt)
		q.UpdatedAt = SafeTime(updatedAt)
		questions = append(questions, q)
	}
	return questions, total, nil
}

func (r *BankSoalRepository) GetQuestion(id string) (*models.Question, error) {
	var q models.Question
	var createdAt, updatedAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT id, bank_id, type, content, media_url, media_type, options, correct_answer,
		       explanation, points, order_number, difficulty, created_by, created_at, updated_at
		FROM questions WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&q.ID, &q.BankID, &q.Type, &q.Content, &q.MediaURL, &q.MediaType,
		&q.Options, &q.CorrectAnswer, &q.Explanation, &q.Points, &q.OrderNumber,
		&q.Difficulty, &q.CreatedBy, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	q.CreatedAt = SafeTime(createdAt)
	q.UpdatedAt = SafeTime(updatedAt)
	return &q, nil
}

func (r *BankSoalRepository) CreateQuestion(req *models.CreateQuestionRequest) (*models.Question, error) {
	id := r.genID()
	now := nowMs()

	// Auto-assign order_number = max + 1
	var maxOrder int
	_ = r.DB.QueryRow("SELECT COALESCE(MAX(order_number), 0) FROM questions WHERE bank_id = ? AND deleted_at IS NULL", req.BankID).Scan(&maxOrder)

	_, err := r.DB.Exec(`
		INSERT INTO questions (id, bank_id, type, content, media_url, media_type, options, correct_answer, explanation, points, order_number, difficulty, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.BankID, req.Type, req.Content, req.MediaURL, req.MediaType,
		req.Options, req.CorrectAnswer, req.Explanation, req.Points, maxOrder+1,
		req.Difficulty, req.CreatedBy, now, now)
	if err != nil {
		return nil, err
	}
	return r.GetQuestion(id)
}

func (r *BankSoalRepository) UpdateQuestion(id string, req *models.UpdateQuestionRequest) (*models.Question, error) {
	sets := []string{"updated_at = ?"}
	args := []interface{}{nowMs()}

	if req.Type != nil {
		sets = append(sets, "type = ?")
		args = append(args, *req.Type)
	}
	if req.Content != nil {
		sets = append(sets, "content = ?")
		args = append(args, *req.Content)
	}
	if req.MediaURL != nil {
		sets = append(sets, "media_url = ?")
		args = append(args, *req.MediaURL)
	}
	if req.MediaType != nil {
		sets = append(sets, "media_type = ?")
		args = append(args, *req.MediaType)
	}
	if req.Options != nil {
		sets = append(sets, "options = ?")
		args = append(args, *req.Options)
	}
	if req.CorrectAnswer != nil {
		sets = append(sets, "correct_answer = ?")
		args = append(args, *req.CorrectAnswer)
	}
	if req.Explanation != nil {
		sets = append(sets, "explanation = ?")
		args = append(args, *req.Explanation)
	}
	if req.Points != nil {
		sets = append(sets, "points = ?")
		args = append(args, *req.Points)
	}
	if req.Difficulty != nil {
		sets = append(sets, "difficulty = ?")
		args = append(args, *req.Difficulty)
	}

	args = append(args, id)
	_, err := r.DB.Exec("UPDATE questions SET "+strings.Join(sets, ", ")+" WHERE id = ? AND deleted_at IS NULL", args...)
	if err != nil {
		return nil, err
	}
	return r.GetQuestion(id)
}

func (r *BankSoalRepository) DeleteQuestion(id string) error {
	_, err := r.DB.Exec("UPDATE questions SET deleted_at = ? WHERE id = ?", nowMs(), id)
	return err
}

func (r *BankSoalRepository) BulkDeleteQuestions(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	now := nowMs()
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	args = append(args, now)
	_, err := r.DB.Exec("UPDATE questions SET deleted_at = ? WHERE id IN ("+strings.Join(placeholders, ", ")+")", args...)
	return err
}

// ══════════════════════════════════════════════════════════
// QUESTION SETS (Paket Soal)
// ══════════════════════════════════════════════════════════

func (r *BankSoalRepository) ListSets(bankID, search string, page, limit int) ([]models.QuestionSet, int, error) {
	where := []string{"qs.deleted_at IS NULL"}
	args := []interface{}{}

	if bankID != "" {
		where = append(where, "qs.bank_id = ?")
		args = append(args, bankID)
	}
	if search != "" {
		where = append(where, "qs.name LIKE ?")
		args = append(args, "%"+search+"%")
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM question_sets qs WHERE "+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT qs.id, qs.name, qs.bank_id, qs.academic_year, qs.mode, qs.shuffle_questions, qs.shuffle_options,
		       qs.timer_minutes, qs.max_attempts, qs.available_from, qs.available_until, qs.result_visible,
		       qs.created_by, qs.created_at, qs.updated_at,
		       qb.title AS bank_title,
		       (SELECT COUNT(*) FROM question_set_items qi JOIN questions q ON qi.question_id = q.id WHERE qi.set_id = qs.id AND q.deleted_at IS NULL) AS item_count
		FROM question_sets qs
		LEFT JOIN question_banks qb ON qs.bank_id = qb.id
		WHERE %s
		ORDER BY qs.created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	queryArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var sets []models.QuestionSet
	for rows.Next() {
		s, err := scanQuestionSet(rows)
		if err != nil {
			return nil, 0, err
		}
		sets = append(sets, *s)
	}
	return sets, total, nil
}

// scanQuestionSet membaca satu baris question_sets dengan kolom lengkap.
func scanQuestionSet(row interface {
	Scan(dest ...interface{}) error
}) (*models.QuestionSet, error) {
	var s models.QuestionSet
	var bankTitle sql.NullString
	var createdAt, updatedAt, availableFrom, availableUntil sql.NullInt64
	var maxAttempts sql.NullInt64
	var mode sql.NullString
	err := row.Scan(&s.ID, &s.Name, &s.BankID, &s.AcademicYear, &mode, &s.ShuffleQuestions,
		&s.ShuffleOptions, &s.TimerMinutes, &maxAttempts, &availableFrom, &availableUntil, &s.ResultVisible,
		&s.CreatedBy, &createdAt, &updatedAt,
		&bankTitle, &s.ItemCount)
	if err != nil {
		return nil, err
	}
	if bankTitle.Valid {
		s.BankTitle = &bankTitle.String
	}
	if mode.Valid {
		s.Mode = mode.String
	} else {
		s.Mode = "latihan"
	}
	if maxAttempts.Valid {
		v := int(maxAttempts.Int64)
		s.MaxAttempts = &v
	}
	s.AvailableFrom = SafeTime(availableFrom)
	s.AvailableUntil = SafeTime(availableUntil)
	s.CreatedAt = SafeTime(createdAt)
	s.UpdatedAt = SafeTime(updatedAt)
	return &s, nil
}

func (r *BankSoalRepository) GetSet(id string) (*models.QuestionSet, error) {
	row := r.DB.QueryRow(`
		SELECT qs.id, qs.name, qs.bank_id, qs.academic_year, qs.mode, qs.shuffle_questions, qs.shuffle_options,
		       qs.timer_minutes, qs.max_attempts, qs.available_from, qs.available_until, qs.result_visible,
		       qs.created_by, qs.created_at, qs.updated_at,
		       qb.title AS bank_title,
		       (SELECT COUNT(*) FROM question_set_items qi JOIN questions q ON qi.question_id = q.id WHERE qi.set_id = qs.id AND q.deleted_at IS NULL) AS item_count
		FROM question_sets qs
		LEFT JOIN question_banks qb ON qs.bank_id = qb.id
		WHERE qs.id = ? AND qs.deleted_at IS NULL
	`, id)
	s, err := scanQuestionSet(row)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *BankSoalRepository) CreateSet(req *models.CreateQuestionSetRequest, createdBy string) (*models.QuestionSet, error) {
	id := r.genID()
	now := nowMs()
	mode := req.Mode
	if mode != "ujian" {
		mode = "latihan"
	}
	resultVisible := true
	if req.ResultVisible != nil {
		resultVisible = *req.ResultVisible
	}
	_, err := r.DB.Exec(`
		INSERT INTO question_sets (id, name, bank_id, academic_year, mode, shuffle_questions, shuffle_options, timer_minutes,
			max_attempts, available_from, available_until, result_visible, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.Name, req.BankID, req.AcademicYear, mode, boolToInt(req.ShuffleQuestions),
		boolToInt(req.ShuffleOptions), req.TimerMinutes, req.MaxAttempts,
		timeToMs(msPtrToTime(req.AvailableFrom)), timeToMs(msPtrToTime(req.AvailableUntil)),
		boolToInt(resultVisible), createdBy, now, now)
	if err != nil {
		return nil, err
	}
	return r.GetSet(id)
}

func (r *BankSoalRepository) UpdateSet(id string, req *models.UpdateQuestionSetRequest) (*models.QuestionSet, error) {
	set, err := r.GetSet(id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		set.Name = *req.Name
	}
	if req.BankID != nil {
		set.BankID = *req.BankID
	}
	if req.AcademicYear != nil {
		set.AcademicYear = req.AcademicYear
	}
	if req.Mode != nil {
		if *req.Mode == "ujian" {
			set.Mode = "ujian"
		} else {
			set.Mode = "latihan"
		}
	}
	if req.ShuffleQuestions != nil {
		set.ShuffleQuestions = *req.ShuffleQuestions
	}
	if req.ShuffleOptions != nil {
		set.ShuffleOptions = *req.ShuffleOptions
	}
	if req.TimerMinutes != nil {
		set.TimerMinutes = req.TimerMinutes
	}
	if req.MaxAttempts != nil {
		set.MaxAttempts = req.MaxAttempts
	}
	if req.AvailableFrom != nil {
		set.AvailableFrom = msPtrToTime(req.AvailableFrom)
	}
	if req.AvailableUntil != nil {
		set.AvailableUntil = msPtrToTime(req.AvailableUntil)
	}
	if req.ResultVisible != nil {
		set.ResultVisible = *req.ResultVisible
	}

	_, err = r.DB.Exec(`
		UPDATE question_sets
		SET name = ?, bank_id = ?, academic_year = ?, mode = ?, shuffle_questions = ?, shuffle_options = ?,
		    timer_minutes = ?, max_attempts = ?, available_from = ?, available_until = ?, result_visible = ?, updated_at = ?
		WHERE id = ? AND deleted_at IS NULL
	`, set.Name, set.BankID, set.AcademicYear, set.Mode, boolToInt(set.ShuffleQuestions),
		boolToInt(set.ShuffleOptions), set.TimerMinutes, set.MaxAttempts,
		timeToMs(set.AvailableFrom), timeToMs(set.AvailableUntil), boolToInt(set.ResultVisible), nowMs(), id)
	if err != nil {
		return nil, err
	}
	return r.GetSet(id)
}

func (r *BankSoalRepository) DeleteSet(id string) error {
	// Soft-delete paket sekaligus membersihkan item agar tidak yatim.
	_, err := r.DB.Exec("DELETE FROM question_set_items WHERE set_id = ?", id)
	if err != nil {
		return err
	}
	_, err = r.DB.Exec("UPDATE question_sets SET deleted_at = ? WHERE id = ?", nowMs(), id)
	return err
}

// ══════════════════════════════════════════════════════════
// QUESTION SET ITEMS
// ══════════════════════════════════════════════════════════

func (r *BankSoalRepository) ListSetItems(setID string) ([]models.QuestionSetItem, error) {
	rows, err := r.DB.Query(`
		SELECT qi.id, qi.set_id, qi.question_id, qi.order_number, qi.points_override,
		       q.id, q.type, q.content, q.media_url, q.media_type, q.options, q.correct_answer,
		       q.explanation, q.points, q.difficulty
		FROM question_set_items qi
		JOIN questions q ON qi.question_id = q.id
		WHERE qi.set_id = ? AND q.deleted_at IS NULL
		ORDER BY qi.order_number ASC
	`, setID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.QuestionSetItem
	for rows.Next() {
		var item models.QuestionSetItem
		var q models.Question
		err := rows.Scan(&item.ID, &item.SetID, &item.QuestionID, &item.OrderNumber, &item.PointsOverride,
			&q.ID, &q.Type, &q.Content, &q.MediaURL, &q.MediaType, &q.Options, &q.CorrectAnswer,
			&q.Explanation, &q.Points, &q.Difficulty)
		if err != nil {
			return nil, err
		}
		q.BankID = ""
		item.Question = &q
		items = append(items, item)
	}
	return items, nil
}

func (r *BankSoalRepository) AddSetItem(setID, questionID string) (*models.QuestionSetItem, error) {
	id := r.genID()

	var maxOrder int
	_ = r.DB.QueryRow("SELECT COALESCE(MAX(order_number), 0) FROM question_set_items WHERE set_id = ?", setID).Scan(&maxOrder)

	_, err := r.DB.Exec(`
		INSERT OR IGNORE INTO question_set_items (id, set_id, question_id, order_number)
		VALUES (?, ?, ?, ?)
	`, id, setID, questionID, maxOrder+1)
	if err != nil {
		return nil, err
	}

	var item models.QuestionSetItem
	err = r.DB.QueryRow("SELECT id, set_id, question_id, order_number, points_override FROM question_set_items WHERE set_id = ? AND question_id = ?", setID, questionID).
		Scan(&item.ID, &item.SetID, &item.QuestionID, &item.OrderNumber, &item.PointsOverride)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *BankSoalRepository) BulkAddSetItems(setID string, questionIDs []string) error {
	if len(questionIDs) == 0 {
		return nil
	}

	var maxOrder int
	_ = r.DB.QueryRow("SELECT COALESCE(MAX(order_number), 0) FROM question_set_items WHERE set_id = ?", setID).Scan(&maxOrder)

	for i, qID := range questionIDs {
		id := r.genID()
		_, _ = r.DB.Exec(`
			INSERT OR IGNORE INTO question_set_items (id, set_id, question_id, order_number)
			VALUES (?, ?, ?, ?)
		`, id, setID, qID, maxOrder+i+1)
	}
	return nil
}

func (r *BankSoalRepository) RemoveSetItem(setID, questionID string) error {
	_, err := r.DB.Exec("DELETE FROM question_set_items WHERE set_id = ? AND question_id = ?", setID, questionID)
	return err
}

func (r *BankSoalRepository) ReorderSetItems(setID string, orderedIDs []string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("UPDATE question_set_items SET order_number = ? WHERE set_id = ? AND question_id = ?")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for i, qID := range orderedIDs {
		if _, err := stmt.Exec(i+1, setID, qID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ══════════════════════════════════════════════════════════
// STUDENT PRACTICES
// ══════════════════════════════════════════════════════════

// GetStudentIDByUserID memetakan user_id (JWT) ke student_id.
func (r *BankSoalRepository) GetStudentIDByUserID(userID string) (string, error) {
	var studentID string
	err := r.DB.QueryRow("SELECT COALESCE(student_id, '') FROM users WHERE id = ?", userID).Scan(&studentID)
	if err != nil {
		return "", err
	}
	return studentID, nil
}

// GetStudentClassID mengembalikan class_id siswa (dari tabel students).
func (r *BankSoalRepository) GetStudentClassID(studentID string) (string, error) {
	var classID sql.NullString
	err := r.DB.QueryRow("SELECT class_id FROM students WHERE id = ?", studentID).Scan(&classID)
	if err != nil {
		return "", err
	}
	return classID.String, nil
}

// ListSetsForStudent mengembalikan paket yang boleh diakses siswa:
//   - mode 'latihan'  -> semua siswa (perilaku lama)
//   - mode 'ujian'    -> hanya bila kelasnya ditugaskan (window tetap ditampilkan,
//     eksekusi dicek saat CreatePractice)
func (r *BankSoalRepository) ListSetsForStudent(studentID string) ([]models.QuestionSet, error) {
	query := `
		SELECT qs.id, qs.name, qs.bank_id, qs.academic_year, qs.mode, qs.shuffle_questions, qs.shuffle_options,
		       qs.timer_minutes, qs.max_attempts, qs.available_from, qs.available_until, qs.result_visible,
		       qs.created_by, qs.created_at, qs.updated_at,
		       qb.title AS bank_title,
		       (SELECT COUNT(*) FROM question_set_items qi JOIN questions q ON qi.question_id = q.id WHERE qi.set_id = qs.id AND q.deleted_at IS NULL) AS item_count
		FROM question_sets qs
		LEFT JOIN question_banks qb ON qs.bank_id = qb.id
		WHERE qs.deleted_at IS NULL
		  AND (
		    qs.mode = 'latihan'
		    OR EXISTS (
		      SELECT 1 FROM exam_assignments ea
		      JOIN students st ON st.class_id = ea.class_id
		      WHERE ea.set_id = qs.id AND st.id = ?
		    )
		  )
		ORDER BY qs.created_at DESC
	`
	rows, err := r.DB.Query(query, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sets []models.QuestionSet
	for rows.Next() {
		s, err := scanQuestionSet(rows)
		if err != nil {
			return nil, err
		}
		sets = append(sets, *s)
	}
	return sets, nil
}

// CountAttempts menghitung jumlah sesi yang sudah dibuat siswa untuk sebuah paket.
func (r *BankSoalRepository) CountAttempts(studentID, setID string) (int, error) {
	var n int
	err := r.DB.QueryRow(
		"SELECT COUNT(*) FROM student_practices WHERE student_id = ? AND set_id = ?",
		studentID, setID,
	).Scan(&n)
	return n, err
}

// ListQuestionIDsInSet mengembalikan id soal dalam paket sesuai urutan.
func (r *BankSoalRepository) ListQuestionIDsInSet(setID string) ([]string, error) {
	rows, err := r.DB.Query(`
		SELECT qi.question_id
		FROM question_set_items qi
		JOIN questions q ON qi.question_id = q.id
		WHERE qi.set_id = ? AND q.deleted_at IS NULL
		ORDER BY qi.order_number ASC
	`, setID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (r *BankSoalRepository) ListPractices(studentID, setID string, page, limit int) ([]models.StudentPractice, int, error) {
	where := []string{"sp.is_completed = 1"}
	args := []interface{}{}

	// Guru memanggil tanpa studentID → tampilkan semua siswa.
	if studentID != "" {
		where = append(where, "sp.student_id = ?")
		args = append(args, studentID)
	}

	if setID != "" {
		where = append(where, "sp.set_id = ?")
		args = append(args, setID)
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM student_practices sp WHERE "+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT sp.id, sp.student_id, sp.set_id, sp.started_at, sp.finished_at,
		       sp.total_score, sp.max_score, sp.is_completed, sp.attempt_number, sp.created_at,
		       qs.name AS set_name, u.name AS student_name
		FROM student_practices sp
		LEFT JOIN question_sets qs ON sp.set_id = qs.id
		LEFT JOIN users u ON sp.student_id = u.student_id
		WHERE %s
		ORDER BY sp.created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	queryArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var practices []models.StudentPractice
	for rows.Next() {
		var p models.StudentPractice
		var setName, studentName sql.NullString
		var startedAt, finishedAt, createdAt sql.NullInt64
		err := rows.Scan(&p.ID, &p.StudentID, &p.SetID, &startedAt, &finishedAt,
			&p.TotalScore, &p.MaxScore, &p.IsCompleted, &p.AttemptNumber, &createdAt,
			&setName, &studentName)
		if err != nil {
			return nil, 0, err
		}
		if setName.Valid {
			p.SetName = &setName.String
		}
		if studentName.Valid {
			p.StudentName = &studentName.String
		}
		p.StartedAt = SafeTime(startedAt)
		p.FinishedAt = SafeTime(finishedAt)
		p.CreatedAt = SafeTime(createdAt)
		practices = append(practices, p)
	}
	return practices, total, nil
}

func (r *BankSoalRepository) GetPractice(id string) (*models.StudentPractice, error) {
	var p models.StudentPractice
	var setName, studentName, mode, questionOrder sql.NullString
	var startedAt, finishedAt, createdAt, deadlineAt sql.NullInt64
	var shuffleQuestions, shuffleOptions, timerMinutes sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT sp.id, sp.student_id, sp.set_id, sp.started_at, sp.finished_at,
		       sp.total_score, sp.max_score, sp.is_completed, sp.attempt_number, sp.created_at,
		       qs.name, u.name,
		       qs.shuffle_questions, qs.shuffle_options, qs.timer_minutes,
		       qs.mode, sp.deadline_at, sp.question_order
		FROM student_practices sp
		LEFT JOIN question_sets qs ON sp.set_id = qs.id
		LEFT JOIN users u ON sp.student_id = u.student_id
		WHERE sp.id = ?
	`, id).Scan(&p.ID, &p.StudentID, &p.SetID, &startedAt, &finishedAt,
		&p.TotalScore, &p.MaxScore, &p.IsCompleted, &p.AttemptNumber, &createdAt,
		&setName, &studentName, &shuffleQuestions, &shuffleOptions, &timerMinutes,
		&mode, &deadlineAt, &questionOrder)
	if err != nil {
		return nil, err
	}
	if setName.Valid {
		p.SetName = &setName.String
	}
	if studentName.Valid {
		p.StudentName = &studentName.String
	}
	if shuffleQuestions.Valid {
		v := shuffleQuestions.Int64 == 1
		p.ShuffleQuestions = &v
	}
	if shuffleOptions.Valid {
		v := shuffleOptions.Int64 == 1
		p.ShuffleOptions = &v
	}
	if timerMinutes.Valid && timerMinutes.Int64 > 0 {
		tm := int(timerMinutes.Int64)
		p.TimerMinutes = &tm
	}
	if mode.Valid {
		m := mode.String
		p.Mode = &m
	}
	if questionOrder.Valid {
		p.QuestionOrder = questionOrder.String
	}
	p.StartedAt = SafeTime(startedAt)
	p.FinishedAt = SafeTime(finishedAt)
	p.CreatedAt = SafeTime(createdAt)
	p.DeadlineAt = SafeTime(deadlineAt)
	return &p, nil
}

func (r *BankSoalRepository) CreatePractice(studentID, setID string, deadlineAt *time.Time, questionOrder []string) (*models.StudentPractice, error) {
	id := r.genID()
	now := nowMs()

	// Calculate attempt number
	var attempt int
	_ = r.DB.QueryRow("SELECT COALESCE(MAX(attempt_number), 0) FROM student_practices WHERE student_id = ? AND set_id = ?", studentID, setID).Scan(&attempt)

	var orderJSON interface{}
	if len(questionOrder) > 0 {
		if b, err := json.Marshal(questionOrder); err == nil {
			orderJSON = string(b)
		}
	}

	_, err := r.DB.Exec(`
		INSERT INTO student_practices (id, student_id, set_id, started_at, total_score, max_score, is_completed, attempt_number, created_at, deadline_at, question_order)
		VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)
	`, id, studentID, setID, now, attempt+1, now, timeToMs(deadlineAt), orderJSON)
	if err != nil {
		return nil, err
	}
	return r.GetPractice(id)
}

func (r *BankSoalRepository) SubmitPractice(practiceID string, answers []models.StudentPracticeAnswer) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Validasi sesi: cegah submit ganda & lewat deadline (grace 60 detik).
	var isCompleted int
	var deadlineAt sql.NullInt64
	err = tx.QueryRow(
		"SELECT is_completed, deadline_at FROM student_practices WHERE id = ?",
		practiceID,
	).Scan(&isCompleted, &deadlineAt)
	if err != nil {
		return err
	}
	if isCompleted == 1 {
		return fmt.Errorf("ujian sudah dikumpulkan")
	}
	if deadlineAt.Valid && deadlineAt.Int64 > 0 && nowMs() > deadlineAt.Int64+60_000 {
		return fmt.Errorf("waktu ujian telah berakhir")
	}

	var totalScore, maxScore float64

	for _, ans := range answers {
		id := r.genID()

		// Get correct answer, points, and question type
		var correctAnswer sql.NullString
		var points int
		var qType string
		err := tx.QueryRow("SELECT correct_answer, points, type FROM questions WHERE id = ?", ans.QuestionID).Scan(&correctAnswer, &points, &qType)
		if err != nil {
			continue
		}

		maxScore += float64(points)
		isCorrect := false
		var pointsEarned float64

		isEssay := qType == "essay"
		graded := true

		if isEssay {
			// Essay dinilai manual: simpan pending (is_correct NULL, poin 0).
			graded = false
		} else if correctAnswer.Valid && ans.Answer != nil && *ans.Answer != "" {
			if gradeAnswer(qType, correctAnswer.String, *ans.Answer) {
				isCorrect = true
				pointsEarned = float64(points)
			}
		}
		totalScore += pointsEarned

		var isCorrectArg interface{}
		if !graded {
			isCorrectArg = nil
		} else if isCorrect {
			isCorrectArg = 1
		} else {
			isCorrectArg = 0
		}

		_, _ = tx.Exec(`
			INSERT OR REPLACE INTO student_practice_answers (id, practice_id, question_id, answer, is_correct, points_earned, answered_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, id, practiceID, ans.QuestionID, ans.Answer, isCorrectArg, pointsEarned, nowMs())
	}

	_, err = tx.Exec(`
		UPDATE student_practices SET total_score = ?, max_score = ?, is_completed = 1, finished_at = ?
		WHERE id = ?
	`, totalScore, maxScore, nowMs(), practiceID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *BankSoalRepository) GetPracticeAnswers(practiceID string) ([]models.StudentPracticeAnswer, error) {
	rows, err := r.DB.Query(`
		SELECT spa.id, spa.practice_id, spa.question_id, spa.answer, spa.is_correct, spa.points_earned, spa.answered_at,
		       q.type, q.content, q.options, q.points, q.explanation, q.correct_answer
		FROM student_practice_answers spa
		LEFT JOIN questions q ON spa.question_id = q.id
		WHERE spa.practice_id = ?
		ORDER BY spa.answered_at ASC
	`, practiceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var answers []models.StudentPracticeAnswer
	for rows.Next() {
		var a models.StudentPracticeAnswer
		var answeredAt sql.NullInt64
		var qType, qContent, qOptions, explanation, correctAnswer sql.NullString
		var qPoints sql.NullInt64
		err := rows.Scan(&a.ID, &a.PracticeID, &a.QuestionID, &a.Answer, &a.IsCorrect, &a.PointsEarned, &answeredAt,
			&qType, &qContent, &qOptions, &qPoints, &explanation, &correctAnswer)
		if err != nil {
			return nil, err
		}
		if qType.Valid {
			t := qType.String
			a.QuestionType = &t
		}
		if qContent.Valid {
			c := qContent.String
			a.QuestionContent = &c
		}
		if qOptions.Valid {
			o := qOptions.String
			a.QuestionOptions = &o
		}
		if qPoints.Valid {
			p := int(qPoints.Int64)
			a.QuestionPoints = &p
		}
		if explanation.Valid {
			e := explanation.String
			a.Explanation = &e
		}
		if correctAnswer.Valid {
			ca := correctAnswer.String
			a.CorrectAnswer = &ca
		}
		a.AnsweredAt = SafeTime(answeredAt)
		answers = append(answers, a)
	}
	return answers, nil
}

// GradeAnswer menyimpan nilai koreksi manual (essay) untuk satu jawaban,
// lalu menghitung ulang total_score praktik.
func (r *BankSoalRepository) GradeAnswer(practiceID, questionID string, isCorrect bool, points float64) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	isCorrectInt := 0
	if isCorrect {
		isCorrectInt = 1
	}

	_, err = tx.Exec(`
		UPDATE student_practice_answers
		SET is_correct = ?, points_earned = ?
		WHERE practice_id = ? AND question_id = ?
	`, isCorrectInt, points, practiceID, questionID)
	if err != nil {
		return err
	}

	// Hitung ulang total score
	var totalScore float64
	err = tx.QueryRow("SELECT COALESCE(SUM(points_earned), 0) FROM student_practice_answers WHERE practice_id = ?", practiceID).Scan(&totalScore)
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE student_practices SET total_score = ? WHERE id = ?", totalScore, practiceID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
