package repository

import (
	"strings"
)

// Catatan: pencarian judul ("Cari Judul") kini hanya membaca katalog lokal
// (lihat SearchBooksByTitle di library_asset_repo.go). Integrasi ke Google
// Books & Open Library dihapus, sehingga helper HTTP/eksternal ikut dibuang.

func normalizeISBN(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	var b strings.Builder
	for _, r := range value {
		if (r >= '0' && r <= '9') || r == 'X' {
			b.WriteRune(r)
		}
	}
	normalized := b.String()
	// Clean string of length 9 to 13 (covering ISBN-10, ISBN-13 with edge padding)
	if len(normalized) < 9 || len(normalized) > 13 {
		return ""
	}
	return normalized
}

func normalizeTitle(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ' {
			b.WriteRune(r)
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
