package repository

import (
	"bytes"
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
	"sync"
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

func lookupISBNOnline(repo *LibraryRepository, isbn string) (*isbnLookupResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	providers := []struct {
		name string
		fn   func(context.Context, string) (*isbnLookupResult, error)
	}{
		{name: "ISBN Perpusnas", fn: lookupISBNPerpusnasPublic},
		{name: "Google Books", fn: lookupISBNGoogleBooks},
		{name: "OpenLibrary", fn: lookupISBNOpenLibrary},
		{name: "Library of Congress", fn: lookupISBNLibraryOfCongress},
	}
	if hasSakedapCredentials() {
		providers = append([]struct {
			name string
			fn   func(context.Context, string) (*isbnLookupResult, error)
		}{{name: "SAKEDAP Perpusnas", fn: lookupISBNSakedap}}, providers...)
	}
	if os.Getenv("ISBNDB_API_KEY") != "" {
		providers = append(providers, struct {
			name string
			fn   func(context.Context, string) (*isbnLookupResult, error)
		}{name: "ISBNdb", fn: lookupISBNDB})
	}

	type providerResult struct {
		index  int
		result *isbnLookupResult
	}
	results := make(chan providerResult, len(providers))
	var wg sync.WaitGroup
	for index, provider := range providers {
		wg.Add(1)
		go func(index int, name string, fn func(context.Context, string) (*isbnLookupResult, error)) {
			defer wg.Done()
			result, err := fn(ctx, isbn)
			if err != nil || result == nil || strings.TrimSpace(result.Title) == "" {
				return
			}
			if result.Source == "" {
				result.Source = name
			}
			results <- providerResult{index: index, result: result}
		}(index, provider.name, provider.fn)
	}
	wg.Wait()
	close(results)

	orderedResults := make([]*isbnLookupResult, len(providers))
	for item := range results {
		orderedResults[item.index] = item.result
	}

	var merged *isbnLookupResult
	for _, result := range orderedResults {
		if result == nil {
			continue
		}
		if merged == nil {
			copy := *result
			copy.Sources = appendUnique(copy.Sources, result.Source)
			merged = &copy
			continue
		}
		mergeISBNResult(merged, result)
	}
	if merged == nil {
		// Fallback to AI Metadata Lookup if no traditional provider returned valid info.
		// Pakai context terpisah dengan timeout lebih panjang: panggilan LLM bisa
		// memakan 15-30 detik, jauh melebihi jendela provider tradisional.
		aiCtx, aiCancel := context.WithTimeout(context.Background(), 35*time.Second)
		defer aiCancel()
		aiRes, aiErr := lookupISBNAIFallback(aiCtx, repo, isbn)
		if aiErr == nil && aiRes != nil && strings.TrimSpace(aiRes.Title) != "" {
			merged = aiRes
		} else {
			return nil, sql.ErrNoRows
		}
	}
	if merged.ISBN == "" {
		merged.ISBN = isbn
	}
	if merged.CoverURL == "" {
		merged.CoverURL = "https://covers.openlibrary.org/b/isbn/" + url.PathEscape(isbn) + "-L.jpg"
	}
	if merged.Category == "" {
		merged.Category = categoryFromSubjects(merged.Subjects)
	}
	if merged.DDCCategory == "" {
		merged.DDCCategory = merged.Category
	}

	return merged, nil
}

// lookupISBNAIFallback memakai AI HANYA untuk mengusulkan kandidat judul+penulis.
// Setiap kandidat WAJIB diverifikasi ke Google Books/Open Library. AI tidak pernah
// menjadi sumber metadata langsung — ini mencegah halusinasi data buku.
func lookupISBNAIFallback(ctx context.Context, repo *LibraryRepository, isbn string) (*isbnLookupResult, error) {
	if repo == nil {
		repo = &LibraryRepository{}
	}

	prompt := fmt.Sprintf(`Sebutkan kemungkinan buku dengan nomor ISBN: %s
Jika kamu mengenali ISBN ini, berikan hingga 3 kandidat judul buku beserta penulisnya.
Balas HANYA JSON valid dengan skema:
{"candidates":[{"title":"Judul Buku","author":"Nama Penulis"}]}
Jika tidak mengenali sama sekali, balas {"candidates":[]}.`, isbn)

	text, err := repo.GenerateAIText(ctx, prompt)
	if err != nil {
		return nil, sql.ErrNoRows
	}

	var parsed struct {
		Candidates []struct {
			Title  string `json:"title"`
			Author string `json:"author"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return nil, sql.ErrNoRows
	}
	if len(parsed.Candidates) == 0 {
		return nil, sql.ErrNoRows
	}

	// Verifikasi setiap kandidat ke katalog nyata. Hanya kandidat yang cocok
	// judul+penulis di Google Books/Open Library yang diterima.
	for _, cand := range parsed.Candidates {
		title := strings.TrimSpace(cand.Title)
		if title == "" {
			continue
		}
		verified := verifyCandidateOnline(ctx, title, cand.Author)
		if verified != nil {
			if verified.ISBN == "" {
				verified.ISBN = isbn
			}
			verified.Sources = appendUnique(verified.Sources, "AI (terverifikasi: "+verified.Source+")")
			verified.Source = "AI + " + verified.Source
			return verified, nil
		}
	}

	return nil, sql.ErrNoRows
}

// verifyCandidateOnline mencari kandidat judul+penulis ke Google Books lalu
// Open Library, lalu memastikan hasilnya benar-benar cocok (bukan sekadar item
// pertama). Mengembalikan nil bila tak ada yang cocok.
func verifyCandidateOnline(ctx context.Context, title, author string) *isbnLookupResult {
	// Coba beberapa variasi query, dari paling presisi ke paling longgar.
	queries := []string{}
	if strings.TrimSpace(title) != "" {
		queries = append(queries, "intitle:"+title)
	}
	if strings.TrimSpace(author) != "" {
		queries = append(queries, title+" "+author)
	}
	queries = append(queries, title)

	seenQuery := map[string]bool{}
	for _, q := range queries {
		q = strings.TrimSpace(q)
		if q == "" || seenQuery[q] {
			continue
		}
		seenQuery[q] = true

		if candidates := searchGoogleBooks(ctx, q, 10); len(candidates) > 0 {
			if match := bestCandidateMatch(title, author, candidates); match != nil {
				match.Source = "Google Books"
				match.Sources = []string{"Google Books"}
				return match
			}
		}
		if candidates := searchOpenLibrary(ctx, q, 10); len(candidates) > 0 {
			if match := bestCandidateMatch(title, author, candidates); match != nil {
				match.Source = "Open Library"
				match.Sources = []string{"Open Library"}
				return match
			}
		}
	}
	return nil
}

// bestCandidateMatch memilih kandidat pertama yang cocok judul (wajib) dan
// penulis (bila diberikan). Bila author tidak diberikan, cukup cocok judul.
func bestCandidateMatch(title, author string, candidates []*isbnLookupResult) *isbnLookupResult {
	for _, c := range candidates {
		if !titleMatches(title, c.Title) {
			continue
		}
		if strings.TrimSpace(author) != "" && !authorMatches(author, c.Author) {
			continue
		}
		return c
	}
	return nil
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

func authorMatches(a, b string) bool {
	na := normalizeTitle(a)
	nb := normalizeTitle(b)
	if na == "" || nb == "" {
		return false
	}
	if strings.Contains(na, nb) || strings.Contains(nb, na) {
		return true
	}
	// Cocokkan setidaknya satu nama kata (mis. "Leila Chudori" vs "Leila S. Chudori").
	for _, token := range strings.Fields(na) {
		if len(token) < 3 {
			continue
		}
		if strings.Contains(nb, token) {
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

func lookupISBNPerpusnasPublic(ctx context.Context, isbn string) (*isbnLookupResult, error) {
	endpoint := "https://isbn.perpusnas.go.id/Account/GetBuku?offset=0&limits=5&kd1=ISBN&kd2=" + url.QueryEscape(isbn)
	headers := map[string]string{
		"Accept":           "application/json, text/javascript, */*; q=0.01",
		"Referer":          "https://isbn.perpusnas.go.id/",
		"X-Requested-With": "XMLHttpRequest",
	}
	var payload struct {
		Rows []struct {
			Judul     string `json:"Judul"`
			Penerbit  string `json:"Penerbit"`
			Pengarang string `json:"Pengarang"`
			Tahun     string `json:"Tahun"`
			ISBN      string `json:"ISBN"`
			Link      string `json:"Link"`
			Website   string `json:"Website"`
			Email     string `json:"Email"`
		} `json:"rows"`
	}
	if err := getJSON(ctx, endpoint, headers, &payload); err != nil || len(payload.Rows) == 0 {
		return nil, err
	}
	row := payload.Rows[0]
	result := &isbnLookupResult{
		Title:       htmlText(row.Judul),
		Author:      htmlText(row.Pengarang),
		Publisher:   htmlText(row.Penerbit),
		Year:        extractYear(row.Tahun),
		ISBN:        firstNonEmpty(normalizeISBN(row.ISBN), isbn),
		Subjects:    []string{"Indonesia", "Perpusnas"},
		Category:    "UNSORTED",
		Description: firstNonEmpty(htmlText(row.Link), htmlText(row.Website), htmlText(row.Email)),
		Source:      "ISBN Perpusnas",
	}
	return result, nil
}

func lookupISBNSakedap(ctx context.Context, isbn string) (*isbnLookupResult, error) {
	body := map[string]interface{}{
		"token":    firstNonEmpty(os.Getenv("SAKEDAP_TOKEN"), os.Getenv("PERPUSNAS_SAKEDAP_TOKEN")),
		"username": firstNonEmpty(os.Getenv("SAKEDAP_USERNAME"), os.Getenv("PERPUSNAS_SAKEDAP_USERNAME")),
		"password": firstNonEmpty(os.Getenv("SAKEDAP_PASSWORD"), os.Getenv("PERPUSNAS_SAKEDAP_PASSWORD")),
		"isbn":     isbn,
	}
	var payload struct {
		Status  string                   `json:"status"`
		Message string                   `json:"message"`
		Data    []map[string]interface{} `json:"data"`
	}
	if err := postJSON(ctx, "https://api-penerbitsakedap.perpusnas.go.id/api/isbn/detail", nil, body, &payload); err != nil {
		return nil, err
	}
	if !strings.EqualFold(payload.Status, "Success") || len(payload.Data) == 0 {
		return nil, sql.ErrNoRows
	}
	row := payload.Data[0]
	authors := firstNonEmpty(mapValue(row, "AUTHOR"), mapValue(row, "AUTHORS"), mapValue(row, "PENGARANG"), mapValue(row, "KEPENG"), mapValue(row, "KEPENGARANGAN"))
	publisher := firstNonEmpty(mapValue(row, "PUBLISHER"), mapValue(row, "PENERBIT"), mapValue(row, "NAMA_PENERBIT"))
	yearText := firstNonEmpty(mapValue(row, "TAHUN_TERBIT"), mapValue(row, "TAHUN"), mapValue(row, "TANGGAL_TERBIT"), mapValue(row, "MOHON_DATE"))
	subjects := splitSubjects(firstNonEmpty(mapValue(row, "SUBJECT"), mapValue(row, "SUBJECTS"), mapValue(row, "KATEGORI"), mapValue(row, "CATEGORY")))
	return &isbnLookupResult{
		Title:       firstNonEmpty(mapValue(row, "TITLE"), mapValue(row, "JUDUL")),
		Author:      authors,
		Publisher:   publisher,
		Year:        extractYear(yearText),
		ISBN:        firstNonEmpty(normalizeISBN(mapValue(row, "ISBN_NO")), normalizeISBN(mapValue(row, "ISBN")), isbn),
		CoverURL:    preferHTTPS(firstNonEmpty(mapValue(row, "COVER"), mapValue(row, "COVER_URL"), mapValue(row, "IMAGE"))),
		Subjects:    appendUnique([]string{"Indonesia", "Perpusnas"}, subjects...),
		DDCCategory: firstNonEmpty(mapValue(row, "DDC"), mapValue(row, "DEWEY"), mapValue(row, "DEWEY_DECIMAL")),
		Category:    firstNonEmpty(mapValue(row, "DDC"), mapValue(row, "DEWEY"), categoryFromSubjects(subjects)),
		Description: firstNonEmpty(mapValue(row, "SINOPSIS"), mapValue(row, "DESCRIPTION"), mapValue(row, "DESKRIPSI")),
		Source:      "SAKEDAP Perpusnas",
	}, nil
}

func hasSakedapCredentials() bool {
	return firstNonEmpty(os.Getenv("SAKEDAP_TOKEN"), os.Getenv("PERPUSNAS_SAKEDAP_TOKEN")) != "" &&
		firstNonEmpty(os.Getenv("SAKEDAP_USERNAME"), os.Getenv("PERPUSNAS_SAKEDAP_USERNAME")) != "" &&
		firstNonEmpty(os.Getenv("SAKEDAP_PASSWORD"), os.Getenv("PERPUSNAS_SAKEDAP_PASSWORD")) != ""
}

func mergeISBNResult(target, incoming *isbnLookupResult) {
	if target.Title == "" {
		target.Title = incoming.Title
	}
	if target.Author == "" {
		target.Author = incoming.Author
	}
	if target.Publisher == "" {
		target.Publisher = incoming.Publisher
	}
	if target.Year == 0 {
		target.Year = incoming.Year
	}
	if target.ISBN == "" {
		target.ISBN = incoming.ISBN
	}
	if target.CoverURL == "" {
		target.CoverURL = incoming.CoverURL
	}
	if target.Description == "" {
		target.Description = incoming.Description
	}
	if target.DDCCategory == "" {
		target.DDCCategory = incoming.DDCCategory
	}
	if target.Category == "" {
		target.Category = incoming.Category
	}
	target.Subjects = appendUnique(target.Subjects, incoming.Subjects...)
	target.Sources = appendUnique(target.Sources, incoming.Source)
	target.Sources = appendUnique(target.Sources, incoming.Sources...)
}

func lookupISBNGoogleBooks(ctx context.Context, isbn string) (*isbnLookupResult, error) {
	apiKey := firstNonEmpty(os.Getenv("GOOGLE_BOOKS_API_KEY"))

	type gbVolumeInfo struct {
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
	}

	fetch := func(query string) (gbVolumeInfo, bool) {
		endpoint := "https://www.googleapis.com/books/v1/volumes?q=" + url.QueryEscape(query)
		if apiKey != "" {
			endpoint += "&key=" + url.QueryEscape(apiKey)
		}
		var payload struct {
			Items []struct {
				VolumeInfo gbVolumeInfo `json:"volumeInfo"`
			} `json:"items"`
		}
		if err := getJSON(ctx, endpoint, nil, &payload); err != nil || len(payload.Items) == 0 {
			return gbVolumeInfo{}, false
		}
		return payload.Items[0].VolumeInfo, true
	}

	// Tiered query: ISBN prefix dulu, lalu angka murni sebagai cadangan.
	// Beberapa edisi Indonesia hanya terindeks pada pencarian angka polos.
	info, ok := fetch("isbn:" + isbn)
	if !ok {
		plain, plainOK := fetch(isbn)
		// Pencarian angka polos bisa mengembalikan buku yang sama sekali lain,
		// jadi hanya diterima bila industryIdentifiers-nya benar cocok.
		if plainOK && identifierMatchesISBN(plain.IndustryIdentifiers, isbn) {
			info, ok = plain, true
		}
	}
	if !ok || strings.TrimSpace(info.Title) == "" {
		return nil, sql.ErrNoRows
	}

	title := strings.TrimSpace(info.Title)
	if info.Subtitle != "" && !strings.Contains(title, info.Subtitle) {
		title += ": " + info.Subtitle
	}
	result := &isbnLookupResult{
		Title:       title,
		Author:      strings.Join(info.Authors, ", "),
		Publisher:   info.Publisher,
		Year:        extractYear(info.PublishedDate),
		ISBN:        isbnFromIdentifiers(info.IndustryIdentifiers, isbn),
		CoverURL:    preferHTTPS(firstNonEmpty(info.ImageLinks.Thumbnail, info.ImageLinks.SmallThumbnail)),
		Subjects:    info.Categories,
		Category:    firstString(info.Categories),
		Description: info.Description,
		Source:      "Google Books",
	}
	return result, nil
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

func lookupISBNOpenLibrary(ctx context.Context, isbn string) (*isbnLookupResult, error) {
	endpoint := "https://openlibrary.org/api/books?bibkeys=ISBN:" + url.QueryEscape(isbn) + "&format=json&jscmd=data"
	var payload map[string]struct {
		Title       string `json:"title"`
		PublishDate string `json:"publish_date"`
		Authors     []struct {
			Name string `json:"name"`
		} `json:"authors"`
		Publishers []struct {
			Name string `json:"name"`
		} `json:"publishers"`
		Subjects []struct {
			Name string `json:"name"`
		} `json:"subjects"`
		Excerpts []struct {
			Text string `json:"text"`
		} `json:"excerpts"`
		Cover struct {
			Small  string `json:"small"`
			Medium string `json:"medium"`
			Large  string `json:"large"`
		} `json:"cover"`
		Identifiers map[string][]string `json:"identifiers"`
	}
	if err := getJSON(ctx, endpoint, nil, &payload); err != nil {
		return nil, err
	}
	data, ok := payload["ISBN:"+isbn]
	if !ok || strings.TrimSpace(data.Title) == "" {
		return nil, sql.ErrNoRows
	}
	authors := make([]string, 0, len(data.Authors))
	for _, author := range data.Authors {
		authors = appendUnique(authors, author.Name)
	}
	publishers := make([]string, 0, len(data.Publishers))
	for _, publisher := range data.Publishers {
		publishers = appendUnique(publishers, publisher.Name)
	}
	subjects := make([]string, 0, len(data.Subjects))
	for _, subject := range data.Subjects {
		subjects = appendUnique(subjects, subject.Name)
	}
	description := ""
	if len(data.Excerpts) > 0 {
		description = data.Excerpts[0].Text
	}
	return &isbnLookupResult{
		Title:       data.Title,
		Author:      strings.Join(authors, ", "),
		Publisher:   strings.Join(publishers, ", "),
		Year:        extractYear(data.PublishDate),
		ISBN:        firstIdentifier(data.Identifiers, isbn),
		CoverURL:    preferHTTPS(firstNonEmpty(data.Cover.Large, data.Cover.Medium, data.Cover.Small)),
		Subjects:    subjects,
		Category:    categoryFromSubjects(subjects),
		Description: description,
		Source:      "OpenLibrary",
	}, nil
}

func lookupISBNLibraryOfCongress(ctx context.Context, isbn string) (*isbnLookupResult, error) {
	endpoint := "https://www.loc.gov/books/?fo=json&fa=number_isbn:" + url.QueryEscape(isbn)
	var payload struct {
		Results []struct {
			Title       string   `json:"title"`
			Date        string   `json:"date"`
			Description []string `json:"description"`
			Subject     []string `json:"subject"`
			Contributor []string `json:"contributor"`
			Publisher   []string `json:"publisher"`
			Isbn        []string `json:"isbn"`
			ImageURL    []string `json:"image_url"`
		} `json:"results"`
	}
	if err := getJSON(ctx, endpoint, nil, &payload); err != nil || len(payload.Results) == 0 {
		return nil, err
	}
	item := payload.Results[0]
	return &isbnLookupResult{
		Title:       strings.TrimSuffix(item.Title, "."),
		Author:      strings.Join(item.Contributor, ", "),
		Publisher:   strings.Join(item.Publisher, ", "),
		Year:        extractYear(item.Date),
		ISBN:        firstString(item.Isbn),
		CoverURL:    preferHTTPS(firstString(item.ImageURL)),
		Subjects:    item.Subject,
		Category:    categoryFromSubjects(item.Subject),
		Description: firstString(item.Description),
		Source:      "Library of Congress",
	}, nil
}

func lookupISBNDB(ctx context.Context, isbn string) (*isbnLookupResult, error) {
	endpoint := "https://api2.isbndb.com/book/" + url.PathEscape(isbn)
	headers := map[string]string{"Authorization": os.Getenv("ISBNDB_API_KEY")}
	var payload struct {
		Book struct {
			Title         string   `json:"title"`
			Authors       []string `json:"authors"`
			Publisher     string   `json:"publisher"`
			DatePublished string   `json:"date_published"`
			ISBN13        string   `json:"isbn13"`
			ISBN          string   `json:"isbn"`
			Image         string   `json:"image"`
			Synopsis      string   `json:"synopsis"`
			Subjects      []string `json:"subjects"`
			DeweyDecimal  string   `json:"dewey_decimal"`
		} `json:"book"`
	}
	if err := getJSON(ctx, endpoint, headers, &payload); err != nil || strings.TrimSpace(payload.Book.Title) == "" {
		return nil, err
	}
	return &isbnLookupResult{
		Title:       payload.Book.Title,
		Author:      strings.Join(payload.Book.Authors, ", "),
		Publisher:   payload.Book.Publisher,
		Year:        extractYear(payload.Book.DatePublished),
		ISBN:        firstNonEmpty(payload.Book.ISBN13, payload.Book.ISBN, isbn),
		CoverURL:    preferHTTPS(payload.Book.Image),
		Subjects:    payload.Book.Subjects,
		DDCCategory: payload.Book.DeweyDecimal,
		Category:    firstNonEmpty(payload.Book.DeweyDecimal, categoryFromSubjects(payload.Book.Subjects)),
		Description: payload.Book.Synopsis,
		Source:      "ISBNdb",
	}, nil
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

func postJSON(ctx context.Context, endpoint string, headers map[string]string, body interface{}, target interface{}) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Sekolahku/1.0 ISBN Lookup")
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

func htmlText(value string) string {
	value = strings.ReplaceAll(value, "&amp;", "&")
	value = strings.ReplaceAll(value, "&quot;", "\"")
	value = strings.ReplaceAll(value, "&#39;", "'")
	value = strings.ReplaceAll(value, "&lt;", "<")
	value = strings.ReplaceAll(value, "&gt;", ">")
	return strings.TrimSpace(value)
}

func mapValue(data map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		for actualKey, value := range data {
			if !strings.EqualFold(actualKey, key) {
				continue
			}
			switch typed := value.(type) {
			case string:
				return strings.TrimSpace(typed)
			case float64:
				if typed == float64(int64(typed)) {
					return strconv.FormatInt(int64(typed), 10)
				}
				return strconv.FormatFloat(typed, 'f', -1, 64)
			case int:
				return strconv.Itoa(typed)
			case nil:
				continue
			default:
				bytes, _ := json.Marshal(typed)
				return strings.TrimSpace(string(bytes))
			}
		}
	}
	return ""
}

func splitSubjects(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := regexp.MustCompile(`[,;/|]+`).Split(value, -1)
	return appendUnique(nil, parts...)
}

func firstIdentifier(identifiers map[string][]string, fallback string) string {
	for _, key := range []string{"isbn_13", "isbn_10", "isbn"} {
		if values := identifiers[key]; len(values) > 0 {
			if normalized := normalizeISBN(values[0]); normalized != "" {
				return normalized
			}
		}
	}
	return fallback
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

func identifierMatchesISBN(identifiers []struct {
	Type       string `json:"type"`
	Identifier string `json:"identifier"`
}, isbn string) bool {
	for _, item := range identifiers {
		if normalizeISBN(item.Identifier) == isbn {
			return true
		}
	}
	return false
}

func categoryFromSubjects(subjects []string) string {
	joined := strings.ToLower(strings.Join(subjects, " "))
	switch {
	case strings.Contains(joined, "computer"), strings.Contains(joined, "technology"), strings.Contains(joined, "programming"):
		return "000"
	case strings.Contains(joined, "philosophy"), strings.Contains(joined, "psychology"):
		return "100"
	case strings.Contains(joined, "religion"), strings.Contains(joined, "islam"), strings.Contains(joined, "christian"):
		return "200"
	case strings.Contains(joined, "social"), strings.Contains(joined, "education"), strings.Contains(joined, "law"), strings.Contains(joined, "econom"):
		return "300"
	case strings.Contains(joined, "language"), strings.Contains(joined, "linguistic"):
		return "400"
	case strings.Contains(joined, "science"), strings.Contains(joined, "mathematics"), strings.Contains(joined, "biology"), strings.Contains(joined, "physics"):
		return "500"
	case strings.Contains(joined, "medicine"), strings.Contains(joined, "engineering"), strings.Contains(joined, "agriculture"), strings.Contains(joined, "management"):
		return "600"
	case strings.Contains(joined, "art"), strings.Contains(joined, "music"), strings.Contains(joined, "sport"):
		return "700"
	case strings.Contains(joined, "literature"), strings.Contains(joined, "fiction"), strings.Contains(joined, "poetry"), strings.Contains(joined, "novel"):
		return "800"
	case strings.Contains(joined, "history"), strings.Contains(joined, "geography"), strings.Contains(joined, "travel"):
		return "900"
	default:
		return "UNSORTED"
	}
}
