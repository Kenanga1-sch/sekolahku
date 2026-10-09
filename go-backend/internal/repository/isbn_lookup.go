package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type isbnLookupResult struct {
	Title       string
	Author      string
	Publisher   string
	Year        int
	ISBN        string
	CoverURL    string
	Subjects    []string
	DDCCategory string
	Category    string
	Description string
	Source      string
	Sources     []string
}

var isbnHTTPClient = &http.Client{Timeout: 5 * time.Second}

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

// titleMatches menilai kecocokan judul dengan toleransi: normalisasi huruf kecil,
// buang tanda baca, dan cek substring dua arah untuk variasi subtitle.
func titleMatches(a, b string) bool {
	na := normalizeTitle(a)
	nb := normalizeTitle(b)
	if na == "" || nb == "" {
		return false
	}
	if na == nb {
		return true
	}
	if strings.Contains(na, nb) || strings.Contains(nb, na) {
		return true
	}
	// Bandingkan kata-kata pertama bermakna (min 2 kata) untuk toleransi subtitle.
	wa := strings.Fields(na)
	wb := strings.Fields(nb)
	if len(wa) >= 2 && len(wb) >= 2 {
		if wa[0] == wb[0] && wa[1] == wb[1] {
			return true
		}
	}
	return false
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

// searchGoogleBooks mencari banyak kandidat via Google Books (untuk fitur Cari
// Judul & verifikasi kandidat AI). maxResults dibatasi 40 oleh API.
func searchGoogleBooks(ctx context.Context, query string, maxResults int) []*isbnLookupResult {
	apiKey := firstNonEmpty(os.Getenv("GOOGLE_BOOKS_API_KEY"))
	if maxResults <= 0 || maxResults > 40 {
		maxResults = 10
	}
	endpoint := "https://www.googleapis.com/books/v1/volumes?q=" + url.QueryEscape(query) + "&maxResults=" + strconv.Itoa(maxResults)
	if apiKey != "" {
		endpoint += "&key=" + url.QueryEscape(apiKey)
	}

	var payload struct {
		Items []struct {
			VolumeInfo struct {
				Title               string   `json:"title"`
				Subtitle            string   `json:"subtitle"`
				Authors             []string `json:"authors"`
				Publisher           string   `json:"publisher"`
				PublishedDate       string   `json:"publishedDate"`
				Description         string   `json:"description"`
				Categories          []string `json:"categories"`
				IndustryIdentifiers []struct {
					Type       string `json:"type"`
					Identifier string `json:"identifier"`
				} `json:"industryIdentifiers"`
				ImageLinks struct {
					Thumbnail      string `json:"thumbnail"`
					SmallThumbnail string `json:"smallThumbnail"`
				} `json:"imageLinks"`
			} `json:"volumeInfo"`
		} `json:"items"`
	}
	if err := getJSON(ctx, endpoint, nil, &payload); err != nil {
		return nil
	}

	results := make([]*isbnLookupResult, 0, len(payload.Items))
	for _, item := range payload.Items {
		info := item.VolumeInfo
		title := strings.TrimSpace(info.Title)
		if title == "" {
			continue
		}
		if info.Subtitle != "" && !strings.Contains(title, info.Subtitle) {
			title += ": " + info.Subtitle
		}
		isbn := isbnFromIdentifiers(info.IndustryIdentifiers, "")
		results = append(results, &isbnLookupResult{
			Title:       title,
			Author:      strings.Join(info.Authors, ", "),
			Publisher:   info.Publisher,
			Year:        extractYear(info.PublishedDate),
			ISBN:        isbn,
			CoverURL:    preferHTTPS(firstNonEmpty(info.ImageLinks.Thumbnail, info.ImageLinks.SmallThumbnail)),
			Subjects:    info.Categories,
			Category:    firstString(info.Categories),
			Description: info.Description,
			Source:      "Google Books",
			Sources:     []string{"Google Books"},
		})
	}
	return results
}

// searchOpenLibrary mencari banyak kandidat judul via Open Library search API.
func searchOpenLibrary(ctx context.Context, query string, maxResults int) []*isbnLookupResult {
	if maxResults <= 0 {
		maxResults = 10
	}
	endpoint := "https://openlibrary.org/search.json?q=" + url.QueryEscape(query) + "&limit=" + strconv.Itoa(maxResults)

	var payload struct {
		Docs []struct {
			Title            string   `json:"title"`
			AuthorName       []string `json:"author_name"`
			Publisher        []string `json:"publisher"`
			FirstPublishYear int      `json:"first_publish_year"`
			ISBN             []string `json:"isbn"`
			CoverI           int      `json:"cover_i"`
		} `json:"docs"`
	}
	if err := getJSON(ctx, endpoint, nil, &payload); err != nil {
		return nil
	}

	results := make([]*isbnLookupResult, 0, len(payload.Docs))
	for _, doc := range payload.Docs {
		title := strings.TrimSpace(doc.Title)
		if title == "" {
			continue
		}
		isbn := ""
		if len(doc.ISBN) > 0 {
			for _, candidate := range doc.ISBN {
				if normalized := normalizeISBN(candidate); normalized != "" {
					isbn = normalized
					break
				}
			}
		}
		cover := ""
		if doc.CoverI > 0 {
			cover = fmt.Sprintf("https://covers.openlibrary.org/b/id/%d-L.jpg", doc.CoverI)
		}
		results = append(results, &isbnLookupResult{
			Title:     title,
			Author:    strings.Join(doc.AuthorName, ", "),
			Publisher: firstString(doc.Publisher),
			Year:      doc.FirstPublishYear,
			ISBN:      isbn,
			CoverURL:  cover,
			Source:    "Open Library",
			Sources:   []string{"Open Library"},
		})
	}
	return results
}

func getJSON(ctx context.Context, endpoint string, headers map[string]string, target interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 Sekolahku/1.0 ISBN Lookup")
	for key, value := range headers {
		if value != "" {
			req.Header.Set(key, value)
		}
	}
	resp, err := isbnHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return sql.ErrNoRows
	}
	return json.NewDecoder(resp.Body).Decode(target)
}

func appendUnique(values []string, additions ...string) []string {
	seen := make(map[string]bool, len(values)+len(additions))
	result := make([]string, 0, len(values)+len(additions))
	for _, value := range append(values, additions...) {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, value)
	}
	return result
}

func extractYear(value string) int {
	re := regexp.MustCompile(`\d{4}`)
	match := re.FindString(value)
	if match == "" {
		return 0
	}
	year, _ := strconv.Atoi(match)
	return year
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func firstString(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return strings.TrimSpace(values[0])
}

func preferHTTPS(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "http://") {
		return "https://" + strings.TrimPrefix(value, "http://")
	}
	return value
}

func isbnFromIdentifiers(identifiers []struct {
	Type       string `json:"type"`
	Identifier string `json:"identifier"`
}, fallback string) string {
	for _, preferred := range []string{"ISBN_13", "ISBN_10"} {
		for _, item := range identifiers {
			if strings.EqualFold(item.Type, preferred) {
				if normalized := normalizeISBN(item.Identifier); normalized != "" {
					return normalized
				}
			}
		}
	}
	return fallback
}

