package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type EOfficeRepository struct {
	DB *sql.DB
}

func NewEOfficeRepository(db *sql.DB) *EOfficeRepository {
	return &EOfficeRepository{DB: db}
}

func monthRoman(month time.Month) string {
	romans := []string{"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"}
	idx := int(month) - 1
	if idx < 0 || idx >= len(romans) {
		return "I"
	}
	return romans[idx]
}

func parseLetterDate(value string) time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Now()
	}
	if t, err := time.Parse("2006-01-02", value); err == nil {
		return t
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t
	}
	return time.Now()
}

// Stats
func (r *EOfficeRepository) GetArsipStats() (*models.ArsipStats, error) {
	stats := &models.ArsipStats{}
	r.DB.QueryRow("SELECT COUNT(*) FROM surat_masuk").Scan(&stats.SuratMasuk)
	r.DB.QueryRow("SELECT COUNT(*) FROM surat_keluar").Scan(&stats.SuratKeluar)
	r.DB.QueryRow("SELECT COUNT(*) FROM disposisi WHERE is_completed = 0").Scan(&stats.PendingTasks)
	return stats, nil
}

// Letter numbering helpers
func (r *EOfficeRepository) CalculateNextLetterSequence(req models.NumberingRequest) (int, error) {
	if req.ClassificationCode == nil || *req.ClassificationCode == "" {
		var last sql.NullInt64
		err := r.DB.QueryRow(`SELECT last_letter_number FROM school_settings LIMIT 1`).Scan(&last)
		if err != nil {
			if err == sql.ErrNoRows {
				return 1, nil
			}
			return 0, err
		}
		return int(last.Int64) + 1, nil
	}

	var targetDate time.Time
	if req.Date != nil && *req.Date != "" {
		parsed, err := time.Parse(time.RFC3339, *req.Date)
		if err == nil {
			targetDate = parsed
		} else {
			targetDate = time.Now()
		}
	} else {
		targetDate = time.Now()
	}

	startOfMonth := time.Date(targetDate.Year(), targetDate.Month(), 1, 0, 0, 0, 0, targetDate.Location()).UnixMilli()
	endOfMonth := time.Date(targetDate.Year(), targetDate.Month(), 1, 0, 0, 0, 0, targetDate.Location()).AddDate(0, 1, 0).UnixMilli()

	var maxSeq sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT MAX(sequence_number) 
		FROM generated_letters 
		WHERE classification_code = ? AND created_at >= ? AND created_at < ?
	`, *req.ClassificationCode, startOfMonth, endOfMonth).Scan(&maxSeq)

	if err != nil && err != sql.ErrNoRows {
		return 0, err
	}

	currentMax := 0
	if maxSeq.Valid {
		currentMax = int(maxSeq.Int64)
	}

	return currentMax + 1, nil
}

func (r *EOfficeRepository) IncrementLetterSequence(req models.IncrementRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := UnixMilli()
	if req.ClassificationCode == nil || *req.ClassificationCode == "" {
		_, err = tx.Exec(`
			UPDATE school_settings 
			SET last_letter_number = ?, updated_at = ?
		`, req.SequenceNumber, now)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(`
		INSERT INTO generated_letters (id, letter_number, classification_code, sequence_number, recipient, template_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, cuid2.Generate(), req.LetterNumber, req.ClassificationCode, req.SequenceNumber, req.Recipient, req.TemplateID, now)

	if err != nil {
		return err
	}

	return tx.Commit()
}

// Archive - Klasifikasi
func (r *EOfficeRepository) GetKlasifikasi() ([]models.KlasifikasiSurat, error) {
	rows, err := r.DB.Query("SELECT code, name, description, is_active FROM klasifikasi_surat WHERE is_active = 1 ORDER BY code ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.KlasifikasiSurat
	for rows.Next() {
		var k models.KlasifikasiSurat
		var desc sql.NullString
		err := rows.Scan(&k.Code, &k.Name, &desc, &k.IsActive)
		if err != nil {
			return nil, err
		}
		if desc.Valid {
			k.Description = &desc.String
		}
		results = append(results, k)
	}
	if results == nil {
		results = []models.KlasifikasiSurat{}
	}
	return results, nil
}

// Archive - Surat Masuk
func (r *EOfficeRepository) GetSuratMasuk(page, limit int, search string) ([]models.SuratMasuk, int, error) {
	offset := (page - 1) * limit
	query := `
		SELECT s.id, s.agenda_number, s.original_number, s.sender, s.subject, s.date_of_letter, s.received_at, 
		       s.classification_code, s.file_path, s.status, s.notes, s.created_at,
		       k.code, k.name
		FROM surat_masuk s
		LEFT JOIN klasifikasi_surat k ON s.classification_code = k.code
		WHERE 1=1
	`
	var args []interface{}
	if search != "" {
		query += " AND (s.agenda_number LIKE ? OR s.sender LIKE ? OR s.subject LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM ("+query+")", args...).Scan(&total)

	query += " ORDER BY s.received_at DESC, s.agenda_number DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.SuratMasuk
	for rows.Next() {
		var s models.SuratMasuk
		var cCode, cName, notes sql.NullString
		var rAt, crAt sql.NullInt64

		err := rows.Scan(
			&s.ID, &s.AgendaNumber, &s.OriginalNumber, &s.Sender, &s.Subject, &s.DateOfLetter, &rAt,
			&s.ClassificationCode, &s.FilePath, &s.Status, &notes, &crAt,
			&cCode, &cName,
		)
		if err != nil {
			return nil, 0, err
		}

		if notes.Valid {
			s.Notes = &notes.String
		}
		s.ReceivedAt = SafeTime(rAt)
		s.CreatedAt = SafeTime(crAt)

		if cCode.Valid {
			s.Classification = &models.KlasifikasiSurat{
				Code: cCode.String,
				Name: cName.String,
			}
		}

		results = append(results, s)
	}
	if results == nil {
		results = []models.SuratMasuk{}
	}
	return results, total, nil
}

func (r *EOfficeRepository) CreateSuratMasuk(s models.SuratMasuk) (string, error) {
	id := s.ID
	if id == "" {
		id = cuid2.Generate()
	}
	now := time.Now().UnixMilli()
	var rAt int64
	if s.ReceivedAt != nil {
		rAt = s.ReceivedAt.UnixMilli()
	} else {
		rAt = now
	}
	if strings.TrimSpace(s.AgendaNumber) == "" {
		received := time.UnixMilli(rAt)
		startOfYear := time.Date(received.Year(), 1, 1, 0, 0, 0, 0, received.Location()).UnixMilli()
		endOfYear := time.Date(received.Year()+1, 1, 1, 0, 0, 0, 0, received.Location()).UnixMilli()
		var count int
		_ = r.DB.QueryRow("SELECT COUNT(*) FROM surat_masuk WHERE received_at >= ? AND received_at < ?", startOfYear, endOfYear).Scan(&count)
		s.AgendaNumber = fmt.Sprintf("SM-%d-%04d", received.Year(), count+1)
	}

	query := `
		INSERT INTO surat_masuk (id, agenda_number, original_number, sender, subject, date_of_letter, received_at, classification_code, file_path, status, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, id, s.AgendaNumber, s.OriginalNumber, s.Sender, s.Subject, s.DateOfLetter, rAt, s.ClassificationCode, s.FilePath, "Menunggu Disposisi", s.Notes, now, now)
	if err != nil {
		return "", err
	}
	return id, nil
}

// Archive - Surat Keluar
func (r *EOfficeRepository) GetSuratKeluar(page, limit int, search, statusFilter string) ([]models.SuratKeluar, int, error) {
	offset := (page - 1) * limit
	query := `
		SELECT s.id, s.mail_number, s.recipient, s.subject, s.date_of_letter, s.classification_code, 
		       s.file_path, s.final_file_path, s.status, s.agenda_number, s.verified_by, s.verified_at, s.digital_signature, s.revision_note, s.template_id, s.created_by, s.created_at,
		       k.code, k.name
		FROM surat_keluar s
		LEFT JOIN klasifikasi_surat k ON s.classification_code = k.code
		WHERE 1=1
	`
	var args []interface{}
	if search != "" {
		query += " AND (s.mail_number LIKE ? OR s.recipient LIKE ? OR s.subject LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern)
	}
	if statusFilter != "" {
		query += " AND s.status = ?"
		args = append(args, statusFilter)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM ("+query+")", args...).Scan(&total)

	query += " ORDER BY s.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.SuratKeluar
	for rows.Next() {
		var s models.SuratKeluar
		var cCode, cName, fPath, fnPath, cBy, agenda, vBy, ds, revNote, tplID sql.NullString
		var vAt sql.NullInt64
		var crAt sql.NullInt64

		err := rows.Scan(
			&s.ID, &s.MailNumber, &s.Recipient, &s.Subject, &s.DateOfLetter, &s.ClassificationCode,
			&fPath, &fnPath, &s.Status, &agenda, &vBy, &vAt, &ds, &revNote, &tplID, &cBy, &crAt,
			&cCode, &cName,
		)
		if err != nil {
			return nil, 0, err
		}

		if fPath.Valid {
			s.FilePath = &fPath.String
		}
		if fnPath.Valid {
			s.FinalFilePath = &fnPath.String
		}
		if cBy.Valid {
			s.CreatedBy = &cBy.String
		}
		if agenda.Valid {
			s.AgendaNumber = &agenda.String
		}
		if vBy.Valid {
			s.VerifiedBy = &vBy.String
		}
		if vAt.Valid {
			s.VerifiedAt = &vAt.Int64
		}
		if ds.Valid {
			s.DigitalSignature = &ds.String
		}
		if revNote.Valid {
			s.RevisionNote = &revNote.String
		}
		if tplID.Valid {
			s.TemplateID = &tplID.String
		}
		s.CreatedAt = SafeTime(crAt)

		if cCode.Valid {
			s.Classification = &models.KlasifikasiSurat{
				Code: cCode.String,
				Name: cName.String,
			}
		}

		results = append(results, s)
	}
	if results == nil {
		results = []models.SuratKeluar{}
	}
	return results, total, nil
}

func (r *EOfficeRepository) GetLetterTemplates(query string, page, perPage int) ([]models.LetterTemplate, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	where := "is_active = 1"
	args := []interface{}{}
	if query != "" {
		where += " AND name LIKE ?"
		args = append(args, "%"+query+"%")
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM letter_templates WHERE "+where, args...).Scan(&total)

	listArgs := append(args, perPage, offset)
	sqlQuery := "SELECT id, name, category, content, file_path, type, paper_size, orientation, classification_code, letter_number_format, is_active, created_at, updated_at FROM letter_templates WHERE " + where + " ORDER BY updated_at DESC LIMIT ? OFFSET ?"

	rows, err := r.DB.Query(sqlQuery, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.LetterTemplate
	for rows.Next() {
		var t models.LetterTemplate
		var content, fPath, clsCode, ltrFmt sql.NullString
		var crAt, upAt sql.NullInt64
		err := rows.Scan(&t.ID, &t.Name, &t.Category, &content, &fPath, &t.Type, &t.PaperSize, &t.Orientation, &clsCode, &ltrFmt, &t.IsActive, &crAt, &upAt)
		if err != nil {
			return nil, 0, err
		}
		if clsCode.Valid {
			t.ClassificationCode = &clsCode.String
		}
		if ltrFmt.Valid {
			t.LetterNumberFormat = &ltrFmt.String
		}
		if content.Valid {
			t.Content = &content.String
		}
		if fPath.Valid {
			t.FilePath = &fPath.String
		}
		t.CreatedAt = SafeTime(crAt)
		t.UpdatedAt = SafeTime(upAt)
		results = append(results, t)
	}
	if results == nil {
		results = []models.LetterTemplate{}
	}
	return results, total, nil
}

func (r *EOfficeRepository) GetLetterTemplateByID(id string) (*models.LetterTemplate, error) {
	var t models.LetterTemplate
	var content, fPath, clsCode, ltrFmt sql.NullString
	var crAt, upAt sql.NullInt64
	err := r.DB.QueryRow("SELECT id, name, category, content, file_path, type, paper_size, orientation, classification_code, letter_number_format, is_active, created_at, updated_at FROM letter_templates WHERE id = ?", id).
		Scan(&t.ID, &t.Name, &t.Category, &content, &fPath, &t.Type, &t.PaperSize, &t.Orientation, &clsCode, &ltrFmt, &t.IsActive, &crAt, &upAt)
	if err != nil {
		return nil, err
	}

	if content.Valid {
		t.Content = &content.String
	}
	if fPath.Valid {
		t.FilePath = &fPath.String
	}
	if clsCode.Valid {
		t.ClassificationCode = &clsCode.String
	}
	if ltrFmt.Valid {
		t.LetterNumberFormat = &ltrFmt.String
	}
	t.CreatedAt = SafeTime(crAt)
	t.UpdatedAt = SafeTime(upAt)
	return &t, nil
}

func (r *EOfficeRepository) CreateLetterTemplate(t models.LetterTemplate) (string, error) {
	if t.ID == "" {
		t.ID = cuid2.Generate()
	}
	if strings.TrimSpace(t.Type) == "" {
		t.Type = "EDITOR"
	}
	if strings.TrimSpace(t.PaperSize) == "" {
		t.PaperSize = "A4"
	}
	if strings.TrimSpace(t.Orientation) == "" {
		t.Orientation = "portrait"
	}
	if strings.TrimSpace(t.Category) == "" {
		t.Category = "GENERAL"
	}
	t.IsActive = true
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO letter_templates (id, name, category, content, file_path, type, paper_size, orientation, classification_code, letter_number_format, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, t.ID, t.Name, t.Category, t.Content, t.FilePath, t.Type, t.PaperSize, t.Orientation, t.ClassificationCode, t.LetterNumberFormat, t.IsActive, now, now)
	return t.ID, err
}

func (r *EOfficeRepository) UpdateLetterTemplate(id string, t models.LetterTemplate) error {
	existing, err := r.GetLetterTemplateByID(id)
	if err != nil {
		return err
	}
	if strings.TrimSpace(t.Name) == "" {
		t.Name = existing.Name
	}
	if strings.TrimSpace(t.Category) == "" {
		t.Category = existing.Category
	}
	if strings.TrimSpace(t.Type) == "" {
		t.Type = existing.Type
	}
	if strings.TrimSpace(t.PaperSize) == "" {
		t.PaperSize = existing.PaperSize
	}
	if strings.TrimSpace(t.Orientation) == "" {
		t.Orientation = existing.Orientation
	}
	if t.Content == nil {
		t.Content = existing.Content
	}
	if t.FilePath == nil {
		t.FilePath = existing.FilePath
	}
	if t.ClassificationCode == nil {
		t.ClassificationCode = existing.ClassificationCode
	}
	if t.LetterNumberFormat == nil {
		t.LetterNumberFormat = existing.LetterNumberFormat
	}

	res, err := r.DB.Exec(`
		UPDATE letter_templates
		SET name = ?, category = ?, content = ?, file_path = ?, type = ?, paper_size = ?, orientation = ?, classification_code = ?, letter_number_format = ?, is_active = 1, updated_at = ?
		WHERE id = ?
	`, t.Name, t.Category, t.Content, t.FilePath, t.Type, t.PaperSize, t.Orientation, t.ClassificationCode, t.LetterNumberFormat, UnixMilli(), id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *EOfficeRepository) DeleteLetterTemplate(id string) error {
	res, err := r.DB.Exec("DELETE FROM letter_templates WHERE id = ?", id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CreateSuratKeluarFromTemplate creates a surat_keluar from letter generator with status "Menunggu Verifikasi"
func (r *EOfficeRepository) CreateSuratKeluarFromTemplate(req models.SuratKeluar) (string, error) {
	if req.ID == "" {
		req.ID = cuid2.Generate()
	}
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO surat_keluar (id, mail_number, recipient, subject, date_of_letter, classification_code, file_path, status, template_id, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu Verifikasi', ?, ?, ?, ?)
	`, req.ID, req.MailNumber, req.Recipient, req.Subject, req.DateOfLetter, req.ClassificationCode, req.FilePath, req.TemplateID, req.CreatedBy, now, now)
	if err != nil {
		return "", err
	}
	return req.ID, nil
}

// VerifySuratKeluar approves a surat_keluar with digital signature and auto-generates agenda number
func (r *EOfficeRepository) VerifySuratKeluar(id, verifiedBy, digitalSignature string) error {
	now := UnixMilli()
	letterDate := time.Now()
	startOfYear := time.Date(letterDate.Year(), 1, 1, 0, 0, 0, 0, letterDate.Location()).UnixMilli()
	endOfYear := time.Date(letterDate.Year()+1, 1, 1, 0, 0, 0, 0, letterDate.Location()).UnixMilli()
	var count int
	r.DB.QueryRow("SELECT COUNT(*) FROM surat_keluar WHERE status = 'Terverifikasi' AND verified_at >= ? AND verified_at < ?", startOfYear, endOfYear).Scan(&count)
	agendaNumber := fmt.Sprintf("SK-%d-%04d", letterDate.Year(), count+1)

	res, err := r.DB.Exec(`
		UPDATE surat_keluar
		SET status = 'Terverifikasi', verified_by = ?, verified_at = ?, digital_signature = ?, agenda_number = ?, updated_at = ?
		WHERE id = ? AND status = 'Menunggu Verifikasi'
	`, verifiedBy, now, digitalSignature, agendaNumber, now, id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// SetSuratKeluarRevision sets status to "Revisi" with a revision note
func (r *EOfficeRepository) SetSuratKeluarRevision(id, revisionNote string) error {
	now := UnixMilli()
	res, err := r.DB.Exec(`
		UPDATE surat_keluar
		SET status = 'Revisi', revision_note = ?, updated_at = ?
		WHERE id = ? AND status = 'Menunggu Verifikasi'
	`, revisionNote, now, id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CreateSuratKeluar creates a new outgoing letter
func (r *EOfficeRepository) CreateSuratKeluar(s models.SuratKeluar) (string, string, error) {
	if s.ID == "" {
		s.ID = cuid2.Generate()
	}
	now := UnixMilli()
	letterDate := parseLetterDate(s.DateOfLetter)
	classCode := ""
	if s.ClassificationCode != nil {
		classCode = strings.TrimSpace(*s.ClassificationCode)
	}
	seq := 0
	if strings.TrimSpace(s.MailNumber) == "" {
		startOfMonth := time.Date(letterDate.Year(), letterDate.Month(), 1, 0, 0, 0, 0, letterDate.Location())
		endOfMonth := startOfMonth.AddDate(0, 1, 0)
		var maxSeq sql.NullInt64
		_ = r.DB.QueryRow(`
			SELECT MAX(sequence_number)
			FROM generated_letters
			WHERE classification_code = ? AND created_at >= ? AND created_at < ?
		`, classCode, startOfMonth.UnixMilli(), endOfMonth.UnixMilli()).Scan(&maxSeq)
		seq = int(maxSeq.Int64) + 1
		if !maxSeq.Valid {
			seq = 1
		}
		s.MailNumber = fmt.Sprintf("%s/%03d/SDN1-KNG/%s/%d", classCode, seq, monthRoman(letterDate.Month()), letterDate.Year())
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO surat_keluar (id, mail_number, recipient, subject, date_of_letter, classification_code, file_path, status, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?)
	`, s.ID, s.MailNumber, s.Recipient, s.Subject, s.DateOfLetter, s.ClassificationCode, s.FilePath, s.CreatedBy, now, now)
	if err != nil {
		return "", "", err
	}

	if seq == 0 {
		_, _ = fmt.Sscanf(s.MailNumber, classCode+"/%03d/", &seq)
		if seq == 0 {
			seq = 1
		}
	}
	recipient := s.Recipient
	if _, err := tx.Exec(`
		INSERT INTO generated_letters (id, letter_number, classification_code, sequence_number, recipient, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, cuid2.Generate(), s.MailNumber, s.ClassificationCode, seq, &recipient, now); err != nil {
		return "", "", err
	}

	return s.ID, s.MailNumber, tx.Commit()
}

// GetSuratMasukByID returns a single incoming letter
func (r *EOfficeRepository) GetSuratMasukByID(id string) (*models.SuratMasuk, error) {
	var s models.SuratMasuk
	var classCode, notes, kCode, kName, kDesc sql.NullString
	var recAt, crAt, upAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT s.id, s.agenda_number, s.original_number, s.sender, s.subject, s.date_of_letter, s.received_at,
		       s.classification_code, s.file_path, s.status, s.notes, s.created_at, s.updated_at,
		       k.code, k.name, k.description
		FROM surat_masuk s
		LEFT JOIN klasifikasi_surat k ON s.classification_code = k.code
		WHERE s.id = ?
	`, id).Scan(&s.ID, &s.AgendaNumber, &s.OriginalNumber, &s.Sender, &s.Subject, &s.DateOfLetter, &recAt,
		&classCode, &s.FilePath, &s.Status, &notes, &crAt, &upAt,
		&kCode, &kName, &kDesc)
	if err != nil {
		return nil, err
	}
	if classCode.Valid {
		s.ClassificationCode = &classCode.String
	}
	if notes.Valid {
		s.Notes = &notes.String
	}
	s.ReceivedAt = SafeTime(recAt)
	s.CreatedAt = SafeTime(crAt)
	s.UpdatedAt = SafeTime(upAt)
	if kCode.Valid {
		s.Classification = &models.KlasifikasiSurat{Code: kCode.String, Name: kName.String}
		if kDesc.Valid {
			s.Classification.Description = &kDesc.String
		}
	}
	dispositions, err := r.GetDisposisiBySuratMasukID(id)
	if err != nil {
		return nil, err
	}
	s.Dispositions = dispositions
	return &s, nil
}

// GetSuratKeluarByID returns a single outgoing letter
func (r *EOfficeRepository) GetSuratKeluarByID(id string) (*models.SuratKeluar, error) {
	var s models.SuratKeluar
	var classCode, filePath, finalPath, createdBy, creatorName, creatorFullName, creatorRole, kCode, kName, kDesc sql.NullString
	var agenda, vBy, ds, revNote, tplID sql.NullString
	var vAt sql.NullInt64
	var crAt, upAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT s.id, s.mail_number, s.recipient, s.subject, s.date_of_letter, s.classification_code,
		       s.file_path, s.final_file_path, s.status, s.agenda_number, s.verified_by, s.verified_at, s.digital_signature, s.revision_note, s.template_id, s.created_by, s.created_at, s.updated_at,
		       u.name, u.full_name, u.role,
		       k.code, k.name, k.description
		FROM surat_keluar s
		LEFT JOIN users u ON s.created_by = u.id
		LEFT JOIN klasifikasi_surat k ON s.classification_code = k.code
		WHERE s.id = ?
	`, id).Scan(&s.ID, &s.MailNumber, &s.Recipient, &s.Subject, &s.DateOfLetter, &classCode,
		&filePath, &finalPath, &s.Status, &agenda, &vBy, &vAt, &ds, &revNote, &tplID, &createdBy, &crAt, &upAt,
		&creatorName, &creatorFullName, &creatorRole,
		&kCode, &kName, &kDesc)
	if err != nil {
		return nil, err
	}
	if classCode.Valid {
		s.ClassificationCode = &classCode.String
	}
	if filePath.Valid {
		s.FilePath = &filePath.String
	}
	if finalPath.Valid {
		s.FinalFilePath = &finalPath.String
	}
	if createdBy.Valid {
		s.CreatedBy = &createdBy.String
	}
	if agenda.Valid {
		s.AgendaNumber = &agenda.String
	}
	if vBy.Valid {
		s.VerifiedBy = &vBy.String
	}
	if vAt.Valid {
		s.VerifiedAt = &vAt.Int64
	}
	if ds.Valid {
		s.DigitalSignature = &ds.String
	}
	if revNote.Valid {
		s.RevisionNote = &revNote.String
	}
	if tplID.Valid {
		s.TemplateID = &tplID.String
	}
	if createdBy.Valid || creatorName.Valid || creatorFullName.Valid {
		s.Creator = &models.User{ID: createdBy.String, Role: creatorRole.String}
		if creatorName.Valid {
			s.Creator.Name = &creatorName.String
		}
		if creatorFullName.Valid {
			s.Creator.FullName = &creatorFullName.String
		}
	}
	s.CreatedAt = SafeTime(crAt)
	s.UpdatedAt = SafeTime(upAt)
	if kCode.Valid {
		s.Classification = &models.KlasifikasiSurat{Code: kCode.String, Name: kName.String}
		if kDesc.Valid {
			s.Classification.Description = &kDesc.String
		}
	}
	return &s, nil
}

func (r *EOfficeRepository) GetDisposisiBySuratMasukID(suratID string) ([]models.Disposisi, error) {
	rows, err := r.DB.Query(`
		SELECT d.id, d.surat_masuk_id, d.from_user_id, d.to_user_id, d.instruction, d.deadline,
		       d.is_completed, d.completed_at, d.completed_note, d.created_at,
		       fu.name, fu.full_name, fu.role,
		       tu.name, tu.full_name, tu.role
		FROM disposisi d
		LEFT JOIN users fu ON d.from_user_id = fu.id
		LEFT JOIN users tu ON d.to_user_id = tu.id
		WHERE d.surat_masuk_id = ?
		ORDER BY d.created_at DESC
	`, suratID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.Disposisi
	for rows.Next() {
		var d models.Disposisi
		var deadline, completedNote sql.NullString
		var isCompleted int
		var completedAt, createdAt sql.NullInt64
		var fromName, fromFullName, fromRole, toName, toFullName, toRole sql.NullString
		if err := rows.Scan(
			&d.ID, &d.SuratMasukID, &d.FromUserID, &d.ToUserID, &d.Instruction, &deadline,
			&isCompleted, &completedAt, &completedNote, &createdAt,
			&fromName, &fromFullName, &fromRole,
			&toName, &toFullName, &toRole,
		); err != nil {
			return nil, err
		}
		if deadline.Valid {
			d.Deadline = &deadline.String
		}
		if completedNote.Valid {
			d.CompletedNote = &completedNote.String
		}
		d.IsCompleted = isCompleted != 0
		d.CompletedAt = SafeTime(completedAt)
		d.CreatedAt = SafeTime(createdAt)

		d.FromUser = &models.User{Role: fromRole.String}
		if fromName.Valid {
			d.FromUser.Name = &fromName.String
		}
		if fromFullName.Valid {
			d.FromUser.FullName = &fromFullName.String
		}
		d.ToUser = &models.User{Role: toRole.String}
		if toName.Valid {
			d.ToUser.Name = &toName.String
		}
		if toFullName.Valid {
			d.ToUser.FullName = &toFullName.String
		}

		results = append(results, d)
	}
	if results == nil {
		results = []models.Disposisi{}
	}
	return results, nil
}

// UpdateSuratKeluar updates an existing outgoing letter
func (r *EOfficeRepository) UpdateSuratKeluar(id string, s models.SuratKeluar) error {
	now := UnixMilli()
	_, err := r.DB.Exec(`
		UPDATE surat_keluar SET mail_number = ?, recipient = ?, subject = ?, date_of_letter = ?,
			classification_code = ?, file_path = ?, final_file_path = ?, status = ?, updated_at = ?
		WHERE id = ?
	`, s.MailNumber, s.Recipient, s.Subject, s.DateOfLetter, s.ClassificationCode, s.FilePath,
		s.FinalFilePath, s.Status, now, id)
	return err
}

func (r *EOfficeRepository) UpdateSuratKeluarFinalFile(id string, finalFilePath string) error {
	res, err := r.DB.Exec(`
		UPDATE surat_keluar
		SET final_file_path = ?, status = 'Arsip', updated_at = ?
		WHERE id = ?
	`, finalFilePath, UnixMilli(), id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CreateDisposisi creates a new disposition
func (r *EOfficeRepository) CreateDisposisi(d models.Disposisi) (string, error) {
	if d.ID == "" {
		d.ID = cuid2.Generate()
	}
	now := UnixMilli()
	tx, err := r.DB.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	_, err = tx.Exec(`
		INSERT INTO disposisi (id, surat_masuk_id, from_user_id, to_user_id, instruction, deadline, is_completed, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 0, ?)
	`, d.ID, d.SuratMasukID, d.FromUserID, d.ToUserID, d.Instruction, d.Deadline, now)
	if err != nil {
		return "", err
	}
	if _, err := tx.Exec("UPDATE surat_masuk SET status = 'Terdisposisi', updated_at = ? WHERE id = ?", now, d.SuratMasukID); err != nil {
		return "", err
	}
	return d.ID, tx.Commit()
}

func (r *EOfficeRepository) GetTemplateVariables(templateID string) ([]string, error) {
	var filePath, content sql.NullString
	err := r.DB.QueryRow("SELECT file_path, content FROM letter_templates WHERE id = ?", templateID).Scan(&filePath, &content)
	if err != nil {
		return nil, err
	}
	if filePath.Valid && strings.TrimSpace(filePath.String) != "" {
		if path := resolveStoredUploadPath(filePath.String); path != "" {
			return ExtractDocxVariables(path)
		}
	}
	if content.Valid {
		return extractTemplateVariablesFromContent(content.String), nil
	}
	return []string{}, nil
}

func resolveStoredUploadPath(storedPath string) string {
	storedPath = strings.TrimSpace(storedPath)
	if storedPath == "" {
		return ""
	}

	candidates := []string{storedPath}
	if strings.HasPrefix(storedPath, "/") {
		candidates = append(candidates, strings.TrimPrefix(storedPath, "/"))
	}
	if strings.HasPrefix(storedPath, "/uploads/") {
		rel := strings.TrimPrefix(storedPath, "/uploads/")
		candidates = append(candidates,
			filepath.Join("uploads", filepath.FromSlash(rel)),
			filepath.Join("public", "uploads", filepath.FromSlash(rel)),
			filepath.Join("..", "public", "uploads", filepath.FromSlash(rel)),
		)
	}

	seen := map[string]bool{}
	for _, candidate := range candidates {
		if candidate == "" || seen[candidate] {
			continue
		}
		seen[candidate] = true
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return ""
}

func extractTemplateVariablesFromContent(content string) []string {
	content = strings.TrimSpace(content)
	if content == "" {
		return []string{}
	}

	var fromJSON []string
	if err := json.Unmarshal([]byte(content), &fromJSON); err == nil {
		return uniqueTemplateVariables(fromJSON)
	}

	re := regexp.MustCompile(`{{\s*([^{}]+?)\s*}}`)
	matches := re.FindAllStringSubmatch(content, -1)
	var variables []string
	for _, match := range matches {
		if len(match) > 1 {
			variables = append(variables, match[1])
		}
	}
	return uniqueTemplateVariables(variables)
}

func uniqueTemplateVariables(values []string) []string {
	seen := map[string]bool{}
	var result []string
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	if result == nil {
		return []string{}
	}
	return result
}
