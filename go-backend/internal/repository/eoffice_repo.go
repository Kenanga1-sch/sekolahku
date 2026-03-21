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
		// Update global sequence in school_settings
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

func (r *EOfficeRepository) GetAnnouncements(includeUnpublished bool) ([]models.Announcement, error) {
	query := `
		SELECT id, title, slug, content, excerpt, category, thumbnail, is_published, is_featured, published_at, author_id, created_at, updated_at
		FROM announcements
	`
	if !includeUnpublished {
		query += " WHERE is_published = 1 "
	}
	query += " ORDER BY published_at DESC LIMIT 10"

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.Announcement
	for rows.Next() {
		var a models.Announcement
		if err := rows.Scan(&a.ID, &a.Title, &a.Slug, &a.Content, &a.Excerpt, &a.Category, &a.Thumbnail, &a.IsPublished, &a.IsFeatured, &a.PublishedAt, &a.AuthorID, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		results = append(results, a)
	}
	
	if results == nil {
		results = []models.Announcement{}
	}
	return results, nil
}
