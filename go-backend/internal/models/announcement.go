package models

import "time"

// Announcement
type Announcement struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Slug        string     `json:"slug"`
	Content     *string    `json:"content"`
	Excerpt     *string    `json:"excerpt"`
	Category    *string    `json:"category"`
	Thumbnail   *string    `json:"thumbnail"`
	IsPublished bool       `json:"is_published"`
	IsFeatured  bool       `json:"is_featured"`
	PublishedAt *time.Time `json:"published_at"`
	AuthorID    *string    `json:"author_id"`
	AuthorName  *string    `json:"author"`
	CreatedAt   *time.Time `json:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at"`
}

type AnnouncementResponse struct {
	Data       []Announcement `json:"data"`
	Pagination struct {
		Page       int `json:"page"`
		Limit      int `json:"limit"`
		Total      int `json:"total"`
		TotalPages int `json:"totalPages"`
	} `json:"pagination"`
}

type CreateAnnouncementRequest struct {
	Title       string  `json:"title"`
	Slug        string  `json:"slug"`
	Content     *string `json:"content"`
	Excerpt     *string `json:"excerpt"`
	Category    *string `json:"category"`
	Thumbnail   *string `json:"thumbnail"`
	IsPublished bool    `json:"is_published"`
	IsFeatured  bool    `json:"is_featured"`
}
