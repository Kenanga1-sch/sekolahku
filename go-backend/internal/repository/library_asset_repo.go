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

	_, err = tx.Exec("UPDATE library_assets SET id = ? WHERE id = ?", newId, oldId)
	if err != nil {
		return errors.New("gagal memperbarui ID aset: " + err.Error())
	}

	_, err = tx.Exec("UPDATE library_loans SET item_id = ? WHERE item_id = ?", newId, oldId)
	if err != nil {
		return errors.New("gagal memperbarui referensi peminjaman: " + err.Error())
	}

	return tx.Commit()
}

// GetAssetByCode retrieves asset details by its QR code (asset ID)
func (r *LibraryRepository) GetAssetByCode(code string) (*models.BookDetail, error) {
	var b models.BookDetail
	var loc, cond, pub, cat sql.NullString
	var yr sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT a.id, a.catalog_id, c.title, c.author, COALESCE(c.isbn,''), a.status, a.location,
		       a.condition, c.publisher, c.year, c.category
		FROM library_assets a
		JOIN library_catalog c ON a.catalog_id = c.id
		WHERE a.id = ?
	`, code).Scan(&b.ID, &b.CatalogID, &b.Title, &b.Author, &b.ISBN, &b.Status, &loc, &cond, &pub, &yr, &cat)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if loc.Valid { b.Location = loc.String }
	if cond.Valid { b.Condition = cond.String }
	if pub.Valid { b.Publisher = pub.String }
	if yr.Valid { b.Year = int(yr.Int64) }
	if cat.Valid { b.Category = cat.String }
	return &b, nil
}

// LookupISBN looks up book info via ISBN (cached or external API)
func (r *LibraryRepository) LookupISBN(isbn string) (*models.ISBNLookupResponse, error) {
	isbn = normalizeISBN(isbn)
	if isbn == "" {
		return nil, nil
	}

	var cachedID, title, author, pub, cat, desc, cover string
	var yr int64
	err := r.DB.QueryRow(`
		SELECT id, title, author, COALESCE(publisher,''), COALESCE(year,0), COALESCE(category,''), COALESCE(description,''), COALESCE(cover,'')
		FROM library_catalog WHERE isbn = ? LIMIT 1
	`, isbn).Scan(&cachedID, &title, &author, &pub, &yr, &cat, &desc, &cover)
	if err == nil {
		return &models.ISBNLookupResponse{
			ID:          cachedID,
			Title:       title,
			Author:      author,
			Publisher:   pub,
			Year:        yr,
			Category:    cat,
			Description: desc,
			Cover:       cover,
		}, nil
	}

	ext, extErr := lookupISBNOnline(isbn)
	if extErr != nil || ext == nil {
		return nil, nil
	}
	return &models.ISBNLookupResponse{
		Title:       ext.Title,
		Author:      ext.Author,
		Publisher:   ext.Publisher,
		Year:        int64(ext.Year),
		Description: ext.DDCCategory,
		Cover:       ext.CoverURL,
	}, nil
}

// BindAsset registers a new asset from QR scan
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
	if isbn != "" {
		_ = tx.QueryRow("SELECT id FROM library_catalog WHERE isbn = ? LIMIT 1", isbn).Scan(&catalogID)
	}
	if catalogID == "" {
		_ = tx.QueryRow("SELECT id FROM library_catalog WHERE LOWER(title) = LOWER(?) AND LOWER(author) = LOWER(?) LIMIT 1", title, catalog.Author).Scan(&catalogID)
	}

	year := catalog.Year
	if catalogID == "" {
		catalogID = cuid2.Generate()
		_, err = tx.Exec(`
			INSERT INTO library_catalog (id, isbn, title, author, publisher, year, category, description, cover, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, catalogID, isbn, title, catalog.Author, catalog.Publisher, year, category, catalog.Description, catalog.Cover, now, now)
		if err != nil {
			return err
		}
	} else {
		var existingISBN, existingTitle, existingAuthor, existingPublisher, existingCategory, existingDescription, existingCover sql.NullString
		var existingYear sql.NullInt64
		err = tx.QueryRow(`
			SELECT isbn, title, author, publisher, year, category, description, cover
			FROM library_catalog
			WHERE id = ?
		`, catalogID).Scan(&existingISBN, &existingTitle, &existingAuthor, &existingPublisher, &existingYear, &existingCategory, &existingDescription, &existingCover)
		if err == nil {
			if (!existingISBN.Valid || existingISBN.String == "") && isbn != "" {
				existingISBN.String = isbn
				existingISBN.Valid = true
			}
			if (!existingAuthor.Valid || existingAuthor.String == "") && catalog.Author != "" {
				existingAuthor.String = catalog.Author
				existingAuthor.Valid = true
			}
			if (!existingPublisher.Valid || existingPublisher.String == "") && catalog.Publisher != "" {
				existingPublisher.String = catalog.Publisher
				existingPublisher.Valid = true
			}
			if (!existingYear.Valid || existingYear.Int64 == 0) && year > 0 {
				existingYear.Int64 = int64(year)
				existingYear.Valid = true
			}
			if (!existingCategory.Valid || existingCategory.String == "" || existingCategory.String == "UNSORTED" || existingCategory.String == "OTHER") && category != "" && category != "UNSORTED" && category != "OTHER" {
				existingCategory.String = category
				existingCategory.Valid = true
			}
			if (!existingDescription.Valid || existingDescription.String == "") && catalog.Description != "" {
				existingDescription.String = catalog.Description
				existingDescription.Valid = true
			}
			if (!existingCover.Valid || existingCover.String == "") && catalog.Cover != "" {
				existingCover.String = catalog.Cover
				existingCover.Valid = true
			}
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
