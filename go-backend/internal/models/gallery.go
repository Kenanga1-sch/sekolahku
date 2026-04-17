package models

import "time"

type GalleryItem struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Category    string     `json:"category"`
	ImageUrl    string     `json:"imageUrl"`
	PublicID    *string    `json:"publicId"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

type GalleryStats struct {
	Total      int               `json:"total"`
	Categories map[string]int    `json:"categories"`
	Storage    GalleryStorageInfo `json:"storage"`
}

type GalleryStorageInfo struct {
	Used float64 `json:"used"`
	Unit string  `json:"unit"`
}
