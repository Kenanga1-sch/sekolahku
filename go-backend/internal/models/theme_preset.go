package models

// SavedTheme — preset tema warna yang bisa dipilih cepat admin
// (Pengaturan → Landing Halaman → kartu Tema Warna).
type SavedTheme struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	BrandTheme  string `json:"brandTheme"` // JSON BrandTheme (lib/theme.ts)
	IsDefault   bool   `json:"isDefault"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}

type SavedThemeRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	BrandTheme  string `json:"brandTheme"`
}
