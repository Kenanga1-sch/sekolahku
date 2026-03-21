package models

import "time"

// GeneratedLetter represents an issued letter log
type GeneratedLetter struct {
	ID                 string     `json:"id"`
	LetterNumber       string     `json:"letterNumber"`
	ClassificationCode *string    `json:"classificationCode"`
	SequenceNumber     int        `json:"sequenceNumber"`
	Recipient          *string    `json:"recipient"`
	TemplateID         *string    `json:"templateId"`
	CreatedAt          *time.Time `json:"createdAt"`
}

type NumberingRequest struct {
	ClassificationCode *string `json:"classificationCode"`
	Date               *string `json:"date"` // Optional ISO date string
}

type NumberingResponse struct {
	NextSequence int `json:"nextSequence"`
}

type IncrementRequest struct {
	LetterNumber       string  `json:"letterNumber"`
	SequenceNumber     int     `json:"sequenceNumber"`
	TemplateID         *string `json:"templateId"`
	Recipient          *string `json:"recipient"`
	ClassificationCode *string `json:"classificationCode"`
}

// Announcement
type Announcement struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Slug        string     `json:"slug"`
	Content     *string    `json:"content"`
	Excerpt     *string    `json:"excerpt"`
	Category    *string    `json:"category"`
	Thumbnail   *string    `json:"thumbnail"`
	IsPublished bool       `json:"isPublished"`
	IsFeatured  bool       `json:"isFeatured"`
	PublishedAt *time.Time `json:"publishedAt"`
	AuthorID    *string    `json:"authorId"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}
