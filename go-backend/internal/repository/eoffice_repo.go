package repository

import (
	"database/sql"
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
		return 1, nil
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

	startOfMonth := time.Date(targetDate.Year(), targetDate.Month(), 1, 0, 0, 0, 0, targetDate.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Second)

	var maxSeq sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT MAX(sequence_number) 
		FROM generated_letters 
		WHERE classification_code = ? AND created_at >= ? AND created_at <= ?
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

	if req.ClassificationCode == nil || *req.ClassificationCode == "" {
		_, err = tx.Exec(`
			UPDATE school_settings 
			SET last_letter_number = ?, updated_at = ?
		`, req.SequenceNumber, time.Now())
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(`
		INSERT INTO generated_letters (id, letter_number, classification_code, sequence_number, recipient, template_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, cuid2.Generate(), req.LetterNumber, req.ClassificationCode, req.SequenceNumber, req.Recipient, req.TemplateID, time.Now())
	
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
		if desc.Valid { k.Description = &desc.String }
		results = append(results, k)
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

		if notes.Valid { s.Notes = &notes.String }
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
	return results, total, nil
}

func (r *EOfficeRepository) CreateSuratMasuk(s models.SuratMasuk) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	var rAt int64
	if s.ReceivedAt != nil { rAt = s.ReceivedAt.UnixMilli() } else { rAt = now }

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
func (r *EOfficeRepository) GetSuratKeluar(page, limit int, search string) ([]models.SuratKeluar, int, error) {
	offset := (page - 1) * limit
	query := `
		SELECT s.id, s.mail_number, s.recipient, s.subject, s.date_of_letter, s.classification_code, 
		       s.file_path, s.final_file_path, s.status, s.created_by, s.created_at,
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
		var cCode, cName, fPath, fnPath, cBy sql.NullString
		var crAt sql.NullInt64

		err := rows.Scan(
			&s.ID, &s.MailNumber, &s.Recipient, &s.Subject, &s.DateOfLetter, &s.ClassificationCode,
			&fPath, &fnPath, &s.Status, &cBy, &crAt,
			&cCode, &cName,
		)
		if err != nil {
			return nil, 0, err
		}

		if fPath.Valid { s.FilePath = &fPath.String }
		if fnPath.Valid { s.FinalFilePath = &fnPath.String }
		if cBy.Valid { s.CreatedBy = &cBy.String }
		s.CreatedAt = SafeTime(crAt)

		if cCode.Valid {
			s.Classification = &models.KlasifikasiSurat{
				Code: cCode.String,
				Name: cName.String,
			}
		}

		results = append(results, s)
	}
	return results, total, nil
}


func (r *EOfficeRepository) GetLetterTemplates(query string) ([]models.LetterTemplate, error) {
	sqlQuery := "SELECT id, name, category, content, file_path, type, paper_size, orientation, is_active, created_at, updated_at FROM letter_templates WHERE 1=1"
	args := []interface{}{}

	if query != "" {
		sqlQuery += " AND name LIKE ?"
		args = append(args, "%"+query+"%")
	}

	sqlQuery += " ORDER BY updated_at DESC"

	rows, err := r.DB.Query(sqlQuery, args...)
	if err != nil { return nil, err }
	defer rows.Close()

	var results []models.LetterTemplate
	for rows.Next() {
		var t models.LetterTemplate
		var content, fPath sql.NullString
		var crAt, upAt sql.NullInt64
		err := rows.Scan(&t.ID, &t.Name, &t.Category, &content, &fPath, &t.Type, &t.PaperSize, &t.Orientation, &t.IsActive, &crAt, &upAt)
		if err != nil { return nil, err }
		if content.Valid { t.Content = &content.String }
		if fPath.Valid { t.FilePath = &fPath.String }
		t.CreatedAt = SafeTime(crAt)
		t.UpdatedAt = SafeTime(upAt)
		results = append(results, t)
	}
	return results, nil
}

func (r *EOfficeRepository) GetLetterTemplateByID(id string) (*models.LetterTemplate, error) {
	var t models.LetterTemplate
	var content, fPath sql.NullString
	var crAt, upAt sql.NullInt64
	err := r.DB.QueryRow("SELECT id, name, category, content, file_path, type, paper_size, orientation, is_active, created_at, updated_at FROM letter_templates WHERE id = ?", id).
		Scan(&t.ID, &t.Name, &t.Category, &content, &fPath, &t.Type, &t.PaperSize, &t.Orientation, &t.IsActive, &crAt, &upAt)
	if err != nil { return nil, err }
	
	if content.Valid { t.Content = &content.String }
	if fPath.Valid { t.FilePath = &fPath.String }
	t.CreatedAt = SafeTime(crAt)
	t.UpdatedAt = SafeTime(upAt)
	return &t, nil
}

func (r *EOfficeRepository) CreateLetterTemplate(t models.LetterTemplate) (string, error) {
	if t.ID == "" { t.ID = cuid2.Generate() }
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO letter_templates (id, name, category, content, file_path, type, paper_size, orientation, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, t.ID, t.Name, t.Category, t.Content, t.FilePath, t.Type, t.PaperSize, t.Orientation, t.IsActive, now, now)
	return t.ID, err
}

func (r *EOfficeRepository) DeleteLetterTemplate(id string) error {
	_, err := r.DB.Exec("DELETE FROM letter_templates WHERE id = ?", id)
	return err
}

