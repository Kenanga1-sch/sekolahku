package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// SwapQR reassigns an old asset QR code to a new one
func (r *LibraryRepository) SwapQR(oldId, newId string) error {
	if oldId == "" || newId == "" {
		return errors.New("QR code lama dan baru wajib diisi")
	}
	if oldId == newId {
		return errors.New("QR code baru harus berbeda dari yang lama")
	}

	// Mengganti PK library_assets.id dengan FK ON selalu gagal di SQLite
	// tanpa penangguhan cek FK (baik update parent atau child duluan).
	// Karena itu seluruh operasi berjalan dalam satu transaksi dengan
	// PRAGMA defer_foreign_keys = ON, dan code QR baru di-reserve di
	// library_qr_codes terlebih dahulu agar tetap unik (mengikuti pola
	// GenerateQRBatch), sementara code lama dilepas.
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var oldExists int
	if err := tx.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = ?", oldId).Scan(&oldExists); err != nil {
		return err
	}
	if oldExists == 0 {
		return errors.New("QR code lama tidak ditemukan")
	}

	var newExists int
	if err := tx.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = ?", newId).Scan(&newExists); err != nil {
		return err
	}
	if newExists > 0 {
		return errors.New("QR code baru sudah terdaftar")
	}

	if _, err := tx.Exec("PRAGMA defer_foreign_keys = ON"); err != nil {
		return err
	}

	// Reserve QR baru (kode unik, batch_id NULL) sebelum dipakai.
	if _, err := tx.Exec("INSERT INTO library_qr_codes (code, batch_id, created_at) VALUES (?, NULL, ?)", newId, UnixMilli()); err != nil {
		return errors.New("QR code baru tidak dapat direservasi: " + err.Error())
	}

	if _, err := tx.Exec("UPDATE library_assets SET id = ? WHERE id = ?", newId, oldId); err != nil {
		return errors.New("gagal memperbarui ID aset: " + err.Error())
	}

	if _, err := tx.Exec("UPDATE library_loans SET item_id = ? WHERE item_id = ?", newId, oldId); err != nil {
		return errors.New("gagal memperbarui referensi peminjaman: " + err.Error())
	}

	// Lepas code lama dari reservasi agar bisa digunakan kembali.
	if _, err := tx.Exec("DELETE FROM library_qr_codes WHERE code = ?", oldId); err != nil {
		return errors.New("gagal melepas reservasi QR lama: " + err.Error())
	}

	return tx.Commit()
}

// GetAssetByCode retrieves asset details by its QR code (asset ID)
func (r *LibraryRepository) GetAssetByCode(code string) (*models.BookDetail, error) {
	var b models.BookDetail
	var loc, cond, pub, cat, desc, cover sql.NullString
	var yr sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT a.id, a.catalog_id, c.title, c.author, COALESCE(c.isbn,''), a.status, a.location,
		       a.condition, c.publisher, c.year, c.category, COALESCE(c.description,''), COALESCE(c.cover,'')
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE a.id = ?
	`, code).Scan(&b.ID, &b.CatalogID, &b.Title, &b.Author, &b.ISBN, &b.Status, &loc, &cond, &pub, &yr, &cat, &desc, &cover)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}
	if loc.Valid { b.Location = loc.String }
	if cond.Valid { b.Condition = cond.String }
	if pub.Valid { b.Publisher = pub.String }
	if yr.Valid { b.Year = int(yr.Int64) }
	if cat.Valid { b.Category = cat.String }
	if desc.Valid { b.Description = desc.String }
	if cover.Valid { b.Cover = cover.String }
	return &b, nil
}

// LookupISBN looks up book info via ISBN (cached or external API).
// Dedup longgar: 1 ISBN boleh dipakai N judul (katalog) berbeda. Bila ISBN
// cocok ke >1 katalog, respons utama tetap katalog pertama (kompatibilitas)
// tetapi Candidates berisi semua katalog agar frontend bisa menampilkan
// picker — buku kedua tidak lagi nyangkut diam-diam ke katalog pertama.
func (r *LibraryRepository) LookupISBN(isbn string) (*models.ISBNLookupResponse, error) {
	isbn = normalizeISBN(isbn)
	if isbn == "" {
		return nil, sql.ErrNoRows
	}

	rows, err := r.DB.Query(`
		SELECT c.id, c.title, COALESCE(c.author,''), COALESCE(c.publisher,''), COALESCE(c.year,0),
		       COALESCE(c.category,''), COALESCE(c.description,''), COALESCE(c.cover,''),
		       (SELECT COUNT(*) FROM library_assets a WHERE a.catalog_id = c.id)
		FROM library_catalog c
		WHERE c.isbn = ? OR c.isbn = ?
		ORDER BY c.created_at ASC
	`, isbn, isbn)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res *models.ISBNLookupResponse
	for rows.Next() {
		var id, title, author, pub, cat, desc, cover string
		var yr int64
		var exemplars int
		if err := rows.Scan(&id, &title, &author, &pub, &yr, &cat, &desc, &cover, &exemplars); err != nil {
			return nil, err
		}
		if res == nil {
			res = &models.ISBNLookupResponse{
				ID:             id,
				Title:          title,
				Author:         author,
				Publisher:      pub,
				Year:           yr,
				ISBN:           isbn,
				Category:       cat,
				DDCCategory:    cat,
				Description:    desc,
				Cover:          cover,
				CoverURL:       cover,
				LocalFound:     true,
				TotalExemplars: exemplars,
				Sources:        []string{"Katalog Lokal"},
			}
		}
		res.Candidates = append(res.Candidates, models.ISBNCandidate{
			ID: id, Title: title, Author: author, TotalExemplars: exemplars,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if res == nil {
		return nil, sql.ErrNoRows
	}
	if len(res.Candidates) > 1 {
		res.Sources = append(res.Sources, "Multi-judul")
	}
	return res, nil
}

// SearchBooksByTitle mencari kandidat buku berdasarkan judul HANYA di katalog
// lokal (library_catalog). Tidak lagi memanggil Google Books/Open Library:
// tujuan Binding adalah menambah eksemplar ke judul yang sudah ada, atau
// menyimpan judul baru — jadi sumbernya cukup koleksi sendiri.
//
// page dimulai dari 1, perPage default 10.
func (r *LibraryRepository) SearchBooksByTitle(query string, page, perPage int) (*models.BookSearchResponse, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return &models.BookSearchResponse{Results: []models.ISBNLookupResponse{}, Page: 1, PerPage: perPage}, nil
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 40 {
		perPage = 10
	}

	like := "%" + query + "%"

	var total int
	if err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM library_catalog
		WHERE title LIKE ? OR COALESCE(author,'') LIKE ? OR COALESCE(isbn,'') LIKE ?
	`, like, like, like).Scan(&total); err != nil {
		return nil, err
	}

	offset := (page - 1) * perPage
	rows, err := r.DB.Query(`
		SELECT c.id, c.title, COALESCE(c.author,''), COALESCE(c.publisher,''), COALESCE(c.year,0),
		       COALESCE(c.isbn,''), COALESCE(c.cover,''), COALESCE(c.category,''), COALESCE(c.description,''),
		       (SELECT COUNT(*) FROM library_assets a WHERE a.catalog_id = c.id)
		FROM library_catalog c
		WHERE c.title LIKE ? OR COALESCE(c.author,'') LIKE ? OR COALESCE(c.isbn,'') LIKE ?
		ORDER BY c.title ASC
		LIMIT ? OFFSET ?
	`, like, like, like, perPage, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.ISBNLookupResponse, 0)
	for rows.Next() {
		var id, title, author, pub, isbn, cover, cat, desc string
		var yr int64
		var exemplars int
		if err := rows.Scan(&id, &title, &author, &pub, &yr, &isbn, &cover, &cat, &desc, &exemplars); err != nil {
			return nil, err
		}
		results = append(results, models.ISBNLookupResponse{
			ID:             id,
			Title:          title,
			Author:         author,
			Publisher:      pub,
			Year:           yr,
			ISBN:           isbn,
			Cover:          cover,
			CoverURL:       cover,
			DDCCategory:    cat,
			Category:       cat,
			Description:    desc,
			Sources:        []string{"Katalog Lokal"},
			LocalFound:     true,
			TotalExemplars: exemplars,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &models.BookSearchResponse{
		Results:    results,
		Page:       page,
		PerPage:    perPage,
		TotalItems: total,
		HasMore:    offset+len(results) < total,
	}, nil
}

// BindAsset mendaftarkan eksemplar baru dari hasil scan QR.
// Penentuan katalog:
//   - CatalogID terisi → eksemplar ditempel ke katalog itu (pilihan user).
//   - selainnya        → cocokkan (ISBN + judul ternormalisasi); tanpa ISBN,
//     cocokkan judul saja; bila tidak ada, buat katalog baru.
//
// Judul input tidak pernah ditimpa oleh katalog lain.
func (r *LibraryRepository) BindAsset(qrCode, location string, catalog models.CatalogInput) error {
	qrCode = strings.TrimSpace(qrCode)
	title := strings.TrimSpace(catalog.Title)
	if qrCode == "" || title == "" {
		return errors.New("QR code dan judul wajib diisi")
	}

	category := strings.TrimSpace(catalog.Category)
	if category == "" {
		category = "UNSORTED"
	}
	isbn := strings.TrimSpace(catalog.ISBN)

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var exists int
	if err := tx.QueryRow("SELECT COUNT(*) FROM library_assets WHERE id = ?", qrCode).Scan(&exists); err != nil {
		return err
	}
	if exists > 0 {
		return errors.New("QR code sudah terdaftar sebagai aset perpustakaan")
	}

	now := UnixMilli()
	catalogID := ""
	switch {
	case strings.TrimSpace(catalog.CatalogID) != "":
		catalogID = strings.TrimSpace(catalog.CatalogID)
		var n int
		if err := tx.QueryRow("SELECT COUNT(*) FROM library_catalog WHERE id = ?", catalogID).Scan(&n); err != nil {
			return err
		}
		if n == 0 {
			return errors.New("katalog yang dipilih tidak ditemukan")
		}
	default:
		catalogID = r.findCatalogLoose(tx, isbn, title)
	}

	created := catalogID == ""
	if created {
		catalogID = cuid2.Generate()
		_, err = tx.Exec(`
			INSERT INTO library_catalog (id, isbn, title, author, publisher, year, category, description, cover, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, catalogID, isbn, title, catalog.Author, catalog.Publisher, catalog.Year, category, catalog.Description, catalog.Cover, now, now)
		if err != nil {
			return err
		}
	}

	if !created {
		_, err = tx.Exec(`
			UPDATE library_catalog SET
				isbn = CASE WHEN isbn IS NULL OR TRIM(isbn) = '' THEN ? ELSE isbn END,
				author = CASE WHEN author IS NULL OR TRIM(author) = '' THEN ? ELSE author END,
				publisher = CASE WHEN publisher IS NULL OR TRIM(publisher) = '' THEN ? ELSE publisher END,
				year = CASE WHEN year IS NULL OR year = 0 THEN ? ELSE year END,
				description = CASE WHEN description IS NULL OR TRIM(description) = '' THEN ? ELSE description END,
				cover = CASE WHEN cover IS NULL OR TRIM(cover) = '' THEN ? ELSE cover END,
				updated_at = ?
			WHERE id = ?
		`, isbn, catalog.Author, catalog.Publisher, catalog.Year, catalog.Description, catalog.Cover, now, catalogID)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(`
		INSERT INTO library_assets (id, catalog_id, status, location, condition, created_at, updated_at)
		VALUES (?, ?, 'AVAILABLE', ?, 'Baik', ?, ?)
	`, qrCode, catalogID, location, now, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// ensureQRCodeTable membuat tabel penahan kode QR bila belum ada.
// Migrasi 000038 yang menjadi jalur utama; ini hanya jaga-jaga untuk
// pemasangan yang melewatkan migrasi, sejalan dengan ensureQRBatchTable.
func (r *LibraryRepository) ensureQRCodeTable() error {
	_, err := r.DB.Exec(`
		CREATE TABLE IF NOT EXISTS library_qr_codes (
			code TEXT PRIMARY KEY,
			batch_id TEXT NOT NULL,
			created_at INTEGER
		)
	`)
	return err
}

const qrSequenceRetryLimit = 100

// GenerateQRBatch generates a batch of QR codes for library assets.
//
// Nomor awal dulu dihitung dengan MAX(end_sequence)+1 lalu disisipkan di LUAR
// transaksi. Dua permintaan yang berbarengan membaca MAX yang sama dan
// mendapat rentang yang sama — terbukti menghasilkan nomor kembar pada 20
// permintaan bersamaan.
//
// Kini seluruhnya berjalan dalam satu transaksi, dan setiap kode dicadangkan
// di library_qr_codes yang `code`-nya primary key. Bila rentang bentrok,
// SQLite menolak penyisipan, transaksi digulung balik, lalu dicoba lagi
// dengan nomor awal berikutnya. Karena itu kode kembar mustahil terjadi:
// bukan "kecil kemungkinannya", melainkan ditolak basis data.
func (r *LibraryRepository) GenerateQRBatch(prefix string, count int) ([]string, *models.QRBatchItem, error) {
	if err := r.ensureQRBatchTable(); err != nil {
		return nil, nil, err
	}
	if err := r.ensureQRCodeTable(); err != nil {
		return nil, nil, err
	}
	prefix = strings.ToUpper(strings.TrimSpace(prefix))
	if prefix == "" {
		prefix = "BK"
	}
	if count < 1 {
		count = 1
	}
	if count > 500 {
		count = 500
	}

	date := TodayJakarta()
	dateCode := NowJakarta().Format("20060102")

	for attempt := 0; attempt < qrSequenceRetryLimit; attempt++ {
		codes, batch, retry, err := r.tryGenerateQRBatch(prefix, dateCode, date, count)
		if err != nil {
			return nil, nil, err
		}
		if !retry {
			return codes, batch, nil
		}
	}
	return nil, nil, errors.New("tidak dapat menemukan nomor QR yang belum terpakai")
}

// tryGenerateQRBatch menjalankan satu percobaan. Mengembalikan retry=true bila
// rentang nomor bentrok dan harus dicoba lagi dengan nomor awal berikutnya.
func (r *LibraryRepository) tryGenerateQRBatch(prefix, dateCode, date string, count int) ([]string, *models.QRBatchItem, bool, error) {
	// Satu koneksi dipakai seluruhnya oleh transaksi ini (SetMaxOpenConns(1)
	// di produksi), jadi setiap query harus lewat tx — query di luar tx akan
	// menunggu transaksi ini selesai, yang menunggu query itu: deadlock.
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, nil, false, err
	}
	defer tx.Rollback()

	startSequence := 1
	if err := tx.QueryRow(`
		SELECT COALESCE(MAX(end_sequence), 0) + 1
		FROM library_qr_batches
		WHERE prefix = ? AND date = ?
	`, prefix, date).Scan(&startSequence); err != nil {
		return nil, nil, false, err
	}
	endSequence := startSequence + count - 1

	codes := make([]string, 0, count)
	for i := startSequence; i <= endSequence; i++ {
		codes = append(codes, fmt.Sprintf("%s-%s-%04d", prefix, dateCode, i))
	}

	id := cuid2.Generate()
	now := UnixMilli()

	// Cadangkan kode dulu. Bentrok di sini berarti rentangnya sudah dipakai.
	for _, code := range codes {
		if _, err := tx.Exec(`
			INSERT INTO library_qr_codes (code, batch_id, created_at) VALUES (?, ?, ?)
		`, code, id, now); err != nil {
			return nil, nil, true, nil
		}
	}

	if _, err := tx.Exec(`
		INSERT INTO library_qr_batches (id, date, prefix, start_sequence, end_sequence, batch_size, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, date, prefix, startSequence, endSequence, count, now); err != nil {
		return nil, nil, false, err
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, false, err
	}

	batch := &models.QRBatchItem{
		ID:            id,
		Date:          date,
		Prefix:        prefix,
		StartSequence: startSequence,
		EndSequence:   endSequence,
		BatchSize:     count,
		CreatedAt:     time.Now(),
	}
	return codes, batch, false, nil
}

// GetQRBatches returns a paginated list of QR code batch records
func (r *LibraryRepository) GetQRBatches(search, date string, page, perPage int) ([]models.QRBatchItem, int, error) {
	if err := r.ensureQRBatchTable(); err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	where := "1=1"
	args := []interface{}{}
	if search = strings.TrimSpace(search); search != "" {
		where += " AND (prefix LIKE ? OR id LIKE ?)"
		like := "%" + search + "%"
		args = append(args, like, like)
	}
	if date = strings.TrimSpace(date); date != "" {
		where += " AND date = ?"
		args = append(args, date)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM library_qr_batches WHERE "+where, args...).Scan(&total)

	listArgs := append(args, perPage, offset)
	query := "SELECT id, date, prefix, start_sequence, end_sequence, batch_size, created_at FROM library_qr_batches WHERE " + where + " ORDER BY created_at DESC LIMIT ? OFFSET ?"

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	batches := make([]models.QRBatchItem, 0)
	for rows.Next() {
		var id, batchDate, prefix string
		var startSequence, endSequence, batchSize int
		var createdAt sql.NullInt64
		if err := rows.Scan(&id, &batchDate, &prefix, &startSequence, &endSequence, &batchSize, &createdAt); err != nil {
			return nil, 0, err
		}
		batches = append(batches, models.QRBatchItem{
			ID:            id,
			Date:          batchDate,
			Prefix:        prefix,
			StartSequence: startSequence,
			EndSequence:   endSequence,
			BatchSize:     batchSize,
			CreatedAt:     ToTime(createdAt),
		})
	}
	return batches, total, nil
}

func (r *LibraryRepository) ensureQRBatchTable() error {
	_, err := r.DB.Exec(`
		CREATE TABLE IF NOT EXISTS library_qr_batches (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			prefix TEXT NOT NULL,
			start_sequence INTEGER NOT NULL,
			end_sequence INTEGER NOT NULL,
			batch_size INTEGER NOT NULL,
			created_at INTEGER
		)
	`)
	return err
}
