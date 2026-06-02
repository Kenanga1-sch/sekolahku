package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type AnnouncementRepository struct {
	DB *sql.DB
}

func NewAnnouncementRepository(db *sql.DB) *AnnouncementRepository {
	return &AnnouncementRepository{DB: db}
}

func (r *AnnouncementRepository) GetAnnouncements(page, limit int, search string, includeUnpublished bool) (*models.AnnouncementResponse, error) {
	offset := (page - 1) * limit
	whereClause := "1=1"
	var args []interface{}

	if !includeUnpublished {
		whereClause += " AND is_published = 1"
	}

	if search != "" {
		whereClause += " AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern)
	}

	// 1. Data Query
	query := fmt.Sprintf(`
		SELECT a.id, a.title, a.slug, a.content, a.excerpt, a.category, a.thumbnail, a.is_published, a.is_featured, a.published_at, a.author_id, u.name as author_name, a.created_at, a.updated_at
		FROM announcements a
		LEFT JOIN users u ON a.author_id = u.id
		WHERE %s
		ORDER BY a.created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	dataArgs := append(args, limit, offset)
	rows, err := r.DB.Query(query, dataArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var announcements []models.Announcement
	for rows.Next() {
		var a models.Announcement
		var content, excerpt, category, thumbnail, authorId, authorName sql.NullString
		var pAt, crAt, upAt sql.NullInt64

		err := rows.Scan(
			&a.ID, &a.Title, &a.Slug, &content, &excerpt, &category, &thumbnail,
			&a.IsPublished, &a.IsFeatured, &pAt, &authorId, &authorName, &crAt, &upAt,
		)
		if err != nil {
			return nil, err
		}

		if content.Valid {
			a.Content = &content.String
		}
		if excerpt.Valid {
			a.Excerpt = &excerpt.String
		}
		if category.Valid {
			a.Category = &category.String
		}
		if thumbnail.Valid {
			a.Thumbnail = &thumbnail.String
		}
		if authorId.Valid {
			a.AuthorID = &authorId.String
		}
		if authorName.Valid {
			a.AuthorName = &authorName.String
		}

		a.PublishedAt = SafeTime(pAt)
		a.CreatedAt = SafeTime(crAt)
		a.UpdatedAt = SafeTime(upAt)

		announcements = append(announcements, a)
	}

	if announcements == nil {
		announcements = []models.Announcement{}
	}

	// 2. Count Query
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM announcements WHERE %s", whereClause)
	var total int
	err = r.DB.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

	return &models.AnnouncementResponse{
		Data: announcements,
		Pagination: struct {
			Page       int `json:"page"`
			Limit      int `json:"limit"`
			Total      int `json:"total"`
			TotalPages int `json:"totalPages"`
		}{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages,
		},
	}, nil
}

func (r *AnnouncementRepository) GetAnnouncementBySlug(slug string) (*models.Announcement, error) {
	query := `
		SELECT a.id, a.title, a.slug, a.content, a.excerpt, a.category, a.thumbnail, a.is_published, a.is_featured, a.published_at, a.author_id, u.name as author_name, a.created_at, a.updated_at
		FROM announcements a
		LEFT JOIN users u ON a.author_id = u.id
		WHERE a.slug = ? OR a.id = ?
	`
	var a models.Announcement
	var content, excerpt, category, thumbnail, authorId, authorName sql.NullString
	var pAt, crAt, upAt sql.NullInt64

	err := r.DB.QueryRow(query, slug, slug).Scan(
		&a.ID, &a.Title, &a.Slug, &content, &excerpt, &category, &thumbnail,
		&a.IsPublished, &a.IsFeatured, &pAt, &authorId, &authorName, &crAt, &upAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if content.Valid {
		a.Content = &content.String
	}
	if excerpt.Valid {
		a.Excerpt = &excerpt.String
	}
	if category.Valid {
		a.Category = &category.String
	}
	if thumbnail.Valid {
		a.Thumbnail = &thumbnail.String
	}
	if authorId.Valid {
		a.AuthorID = &authorId.String
	}
	if authorName.Valid {
		a.AuthorName = &authorName.String
	}

	a.PublishedAt = SafeTime(pAt)
	a.CreatedAt = SafeTime(crAt)
	a.UpdatedAt = SafeTime(upAt)

	return &a, nil
}

func (r *AnnouncementRepository) CreateAnnouncement(req models.CreateAnnouncementRequest) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	var pAt int64
	if req.IsPublished {
		pAt = now
	}

	query := `
		INSERT INTO announcements (id, title, slug, content, excerpt, category, thumbnail, is_published, is_featured, published_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, id, req.Title, req.Slug, req.Content, req.Excerpt, req.Category, req.Thumbnail, req.IsPublished, req.IsFeatured, pAt, now, now)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (r *AnnouncementRepository) UpdateAnnouncement(id string, req models.CreateAnnouncementRequest) error {
	now := time.Now().UnixMilli()

	// Get current version for published_at logic
	var currentPublished bool
	var currentPublishedAt sql.NullInt64
	if err := r.DB.QueryRow("SELECT is_published, published_at FROM announcements WHERE id = ?", id).Scan(&currentPublished, &currentPublishedAt); err != nil {
		return err
	}

	pAt := currentPublishedAt.Int64
	if req.IsPublished && !currentPublished {
		pAt = now
	} else if !req.IsPublished {
		pAt = 0
	}

	query := `
		UPDATE announcements 
		SET title=?, slug=?, content=?, excerpt=?, category=?, thumbnail=?, is_published=?, is_featured=?, published_at=?, updated_at=?
		WHERE id=?
	`
	res, err := r.DB.Exec(query, req.Title, req.Slug, req.Content, req.Excerpt, req.Category, req.Thumbnail, req.IsPublished, req.IsFeatured, pAt, now, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err == nil && affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *AnnouncementRepository) DeleteAnnouncement(id string) error {
	res, err := r.DB.Exec("DELETE FROM announcements WHERE id = ?", id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err == nil && affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
