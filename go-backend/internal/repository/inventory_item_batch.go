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

// ============ Pelacakan per unit untuk barang habis pakai ============
//
// Tujuan: menjawab "bungkus nomor berapa yang keluar, ke mana". Penomoran
// sebelumnya dihitung dari current_stock, yang naik-turun sehingga nomor tidak
// pernah stabil. Kini tiap penerimaan membentuk batch, dan tiap bungkus punya
// baris sendiri.
//
// Invariant yang dijaga:
//
//	jumlah unit AVAILABLE milik suatu item == inventory_items.current_stock
//
// Kalau ini meleset, laporan stok dan hasil pemeriksaan fisik akan saling
// bertentangan. Karena itu setiap perubahan stok dilakukan dalam transaksi
// yang sama dengan perubahan status unit.

// ErrUnitNotAvailable dipakai bila nomor yang diminta sudah keluar.
var ErrUnitNotAvailable = errors.New("nomor unit tidak tersedia")

// ErrUnitNotFound dipakai bila nomor yang diminta tidak dikenal.
var ErrUnitNotFound = errors.New("nomor unit tidak ditemukan")

// YearOf menentukan tahun penomoran dari waktu transaksi. Penomoran dimulai
// ulang setiap ganti tahun, mengikuti tanggal transaksi (bukan tahun anggaran)
// agar barang yang masuk tanpa tahun anggaran jelas — hibah, sisa tahun lalu —
// tetap tercatat rapi.
func YearOf(t time.Time) int {
	return t.Year()
}

// nextUnitNo mengambil nomor awal berikutnya untuk item pada tahun tertentu.
// Dipanggil di dalam transaksi agar dua penerimaan bersamaan tidak mendapat
// nomor kembar.
func nextUnitNo(tx *sql.Tx, itemID string, year int) (int, error) {
	var last sql.NullInt64
	if err := tx.QueryRow(`
		SELECT MAX(unit_no) FROM inventory_item_units
		WHERE item_id = ? AND year = ? AND deleted_at IS NULL
	`, itemID, year).Scan(&last); err != nil {
		return 0, err
	}
	if !last.Valid {
		return 1, nil
	}
	return int(last.Int64) + 1, nil
}

// CreateBatchForInTransaction membuat batch berikut unit-unitnya untuk satu
// transaksi barang masuk. Dipanggil dari dalam transaksi CreateTransaction
// agar stok dan unit tidak pernah berbeda.
//
// Kalau item belum punya unit sama sekali (data lama), unit yang sudah ada di
// gudang menurut current_stock tidak dibuatkan mundur — nomor hanya berlaku
// untuk penerimaan sejak fitur ini aktif.
func (r *InventoryRepository) createBatchForInTx(tx *sql.Tx, t models.InventoryTransaction, trxID string, userID *string, now int64) error {
	var name string
	var itemExists bool
	if err := tx.QueryRow(
		"SELECT name FROM inventory_items WHERE id = ? AND deleted_at IS NULL", t.ItemID,
	).Scan(&name); err == nil {
		itemExists = true
	} else if err != sql.ErrNoRows {
		return nil
	} else if err != nil {
		return err
	}
	if !itemExists {
		return nil
	}

	received := time.UnixMilli(now)
	if t.Date != nil {
		received = *t.Date
	}
	year := YearOf(received)

	startNo, err := nextUnitNo(tx, t.ItemID, year)
	if err != nil {
		return err
	}
	qty := t.Quantity
	if qty <= 0 {
		return nil
	}
	endNo := startNo + qty - 1

	batchID := cuid2.Generate()
	code := fmt.Sprintf("%s-%d-%02d", batchCodePrefix(name), year%100, sequenceOfBatch(tx, t.ItemID, year)+1)

	funding, fiscal, err := itemFundingTx(tx, t.ItemID)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(`
		INSERT INTO inventory_item_batches
			(id, item_id, batch_code, year, start_no, end_no, quantity,
			 funding_source, fiscal_year, received_at, description, transaction_id,
			 created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, batchID, t.ItemID, code, year, startNo, endNo, qty,
		funding, fiscal, received.UnixMilli(), t.Description, trxID, now, now); err != nil {
		return err
	}

	ins, err := tx.Prepare(`
		INSERT INTO inventory_item_units
			(id, item_id, batch_id, unit_no, year, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer ins.Close()

	for no := startNo; no <= endNo; no++ {
		if _, err := ins.Exec(cuid2.Generate(), t.ItemID, batchID, no, year, string(models.ItemUnitAvailable), now, now); err != nil {
			return err
		}
	}

	r.logInventoryAuditTx(tx, "CREATE", "ITEM_BATCH", batchID, []map[string]interface{}{
		{"field": "itemId", "oldValue": nil, "newValue": t.ItemID},
		{"field": "batchCode", "oldValue": nil, "newValue": code},
		{"field": "range", "oldValue": nil, "newValue": fmt.Sprintf("%d-%d", startNo, endNo)},
		{"field": "quantity", "oldValue": nil, "newValue": qty},
	}, userID)

	return nil
}

// itemFundingTx membaca sumber dana & tahun anggaran item, dipakai untuk
// mewariskannya ke batch.
func itemFundingTx(tx *sql.Tx, itemID string) (*string, *int, error) {
	var fs sql.NullString
	var fy sql.NullInt64
	if err := tx.QueryRow(
		"SELECT funding_source, fiscal_year FROM inventory_items WHERE id = ?", itemID,
	).Scan(&fs, &fy); err != nil {
		return nil, nil, err
	}
	var outFS *string
	var outFY *int
	if fs.Valid {
		v := fs.String
		outFS = &v
	}
	if fy.Valid {
		v := int(fy.Int64)
		outFY = &v
	}
	return outFS, outFY, nil
}

// sequenceOfBatch menghitung urutan batch dalam tahun berjalan, dipakai untuk
// menyusun kode batch yang mudah dibaca.
func sequenceOfBatch(tx *sql.Tx, itemID string, year int) int {
	var n int
	if err := tx.QueryRow(
		"SELECT COUNT(*) FROM inventory_item_batches WHERE item_id = ? AND year = ? AND deleted_at IS NULL",
		itemID, year).Scan(&n); err != nil {
		return 0
	}
	return n
}

// batchCodePrefix menyusun awalan kode batch dari nama barang.
func batchCodePrefix(name string) string {
	parts := strings.Fields(strings.ToUpper(name))
	if len(parts) == 0 {
		return "ITEM"
	}
	out := ""
	for _, p := range parts {
		out += p
		if len(out) >= 6 {
			break
		}
	}
	if len(out) > 10 {
		out = out[:10]
	}
	return out
}

// IssueUnits menandai nomor-nomor tertentu sudah keluar ke tujuan tertentu.
// Nomor yang tidak tersedia ditolak, sehingga tidak mungkin mengeluarkan
// bungkus yang sama dua kali.
func (r *InventoryRepository) IssueUnits(itemID, trxID, issuedTo string, userID *string, numbers []int, when time.Time) error {
	if len(numbers) == 0 {
		return nil
	}
	year := YearOf(when)
	now := when.UnixMilli()

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	ins, err := tx.Prepare(`
		UPDATE inventory_item_units
		SET status = ?, issued_to = ?, issued_at = ?, transaction_id = ?, updated_at = ?
		WHERE item_id = ? AND year = ? AND unit_no = ? AND deleted_at IS NULL AND status = ?
	`)
	if err != nil {
		return err
	}
	defer ins.Close()

	for _, no := range numbers {
		res, err := ins.Exec(string(models.ItemUnitIssued), issuedTo, now, trxID, now,
			itemID, year, no, string(models.ItemUnitAvailable))
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if n == 0 {
			// Bisa karena nomor tidak ada, atau sudah keluar. Bedakan pesannya
			// supaya petugas tahu apa yang salah.
			var exists int
			if err := tx.QueryRow(`
				SELECT COUNT(*) FROM inventory_item_units
				WHERE item_id = ? AND year = ? AND unit_no = ? AND deleted_at IS NULL
			`, itemID, year, no).Scan(&exists); err != nil {
				return err
			}
			if exists == 0 {
				return fmt.Errorf("%w: nomor %d tahun %d", ErrUnitNotFound, no, year)
			}
			return fmt.Errorf("%w: nomor %d sudah keluar", ErrUnitNotAvailable, no)
		}
	}

	r.logInventoryAuditTx(tx, "UPDATE", "ITEM_UNIT", itemID, []map[string]interface{}{
		{"field": "issuedUnits", "oldValue": nil, "newValue": numbers},
		{"field": "issuedTo", "oldValue": nil, "newValue": issuedTo},
	}, userID)

	return tx.Commit()
}

// ReturnUnits mengembalikan nomor-nomor tertentu menjadi tersedia lagi.
// Dipakai bila barang yang sudah dikeluarkan ternyata tidak jadi dipakai.
func (r *InventoryRepository) ReturnUnits(itemID string, userID *string, numbers []int, when time.Time) error {
	if len(numbers) == 0 {
		return nil
	}
	year := YearOf(when)
	now := when.UnixMilli()

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	upd, err := tx.Prepare(`
		UPDATE inventory_item_units
		SET status = ?, issued_to = NULL, issued_at = NULL, updated_at = ?
		WHERE item_id = ? AND year = ? AND unit_no = ? AND deleted_at IS NULL AND status = ?
	`)
	if err != nil {
		return err
	}
	defer upd.Close()

	for _, no := range numbers {
		res, err := upd.Exec(string(models.ItemUnitAvailable), now,
			itemID, year, no, string(models.ItemUnitIssued))
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if n == 0 {
			return fmt.Errorf("%w: nomor %d tidak sedang keluar", ErrUnitNotAvailable, no)
		}
	}

	r.logInventoryAuditTx(tx, "UPDATE", "ITEM_UNIT", itemID, []map[string]interface{}{
		{"field": "returnedUnits", "oldValue": nil, "newValue": numbers},
	}, userID)

	return tx.Commit()
}

// GetItemUnits mengembalikan unit-unit suatu item, opsional hanya yang masih
// tersedia. Dipakai picker nomor pada form barang keluar.
func (r *InventoryRepository) GetItemUnits(itemID string, year int, onlyAvailable bool) ([]models.ItemUnit, error) {
	query := `
		SELECT id, item_id, batch_id, unit_no, year, status, issued_to, issued_at, transaction_id, created_at, updated_at
		FROM inventory_item_units
		WHERE item_id = ? AND year = ? AND deleted_at IS NULL
	`
	if onlyAvailable {
		query += " AND status = '" + string(models.ItemUnitAvailable) + "'"
	}
	query += " ORDER BY unit_no ASC"

	rows, err := r.DB.Query(query, itemID, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.ItemUnit, 0)
	for rows.Next() {
		var u models.ItemUnit
		var batchID, issuedTo, trxID sql.NullString
		var issuedAt, crAt, upAt sql.NullInt64
		if err := rows.Scan(&u.ID, &u.ItemID, &batchID, &u.UnitNo, &u.Year, &u.Status,
			&issuedTo, &issuedAt, &trxID, &crAt, &upAt); err != nil {
			return nil, err
		}
		if batchID.Valid {
			v := batchID.String
			u.BatchID = &v
		}
		if issuedTo.Valid {
			v := issuedTo.String
			u.IssuedTo = &v
		}
		if issuedAt.Valid {
			v := issuedAt.Int64
			u.IssuedAt = &v
		}
		if trxID.Valid {
			v := trxID.String
			u.TransactionID = &v
		}
		if crAt.Valid {
			v := crAt.Int64
			u.CreatedAt = &v
		}
		if upAt.Valid {
			v := upAt.Int64
			u.UpdatedAt = &v
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// GetItemBatches mengembalikan daftar batch suatu item, terbaru lebih dulu.
// Dipakai halaman cetak label.
func (r *InventoryRepository) GetItemBatches(itemID string) ([]models.ItemBatch, error) {
	rows, err := r.DB.Query(`
		SELECT id, item_id, batch_code, year, start_no, end_no, quantity,
		       funding_source, fiscal_year, received_at, description, transaction_id,
		       created_at, updated_at
		FROM inventory_item_batches
		WHERE item_id = ? AND deleted_at IS NULL
		ORDER BY year DESC, start_no DESC
	`, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.ItemBatch, 0)
	for rows.Next() {
		var b models.ItemBatch
		var code sql.NullString
		var funding sql.NullString
		var fiscal, received, crAt, upAt sql.NullInt64
		var desc, trxID sql.NullString
		if err := rows.Scan(&b.ID, &b.ItemID, &code, &b.Year, &b.StartNo, &b.EndNo,
			&b.Quantity, &funding, &fiscal, &received, &desc, &trxID, &crAt, &upAt); err != nil {
			return nil, err
		}
		if code.Valid {
			b.BatchCode = code.String
		}
		if funding.Valid {
			v := funding.String
			b.FundingSource = &v
		}
		if fiscal.Valid {
			v := int(fiscal.Int64)
			b.FiscalYear = &v
		}
		if received.Valid {
			v := received.Int64
			b.ReceivedAt = &v
		}
		if desc.Valid {
			v := desc.String
			b.Description = &v
		}
		if trxID.Valid {
			v := trxID.String
			b.TransactionID = &v
		}
		if crAt.Valid {
			v := crAt.Int64
			b.CreatedAt = &v
		}
		if upAt.Valid {
			v := upAt.Int64
			b.UpdatedAt = &v
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// CountAvailableUnits menghitung unit yang masih tersedia. Dipakai untuk
// menegakkan invariant terhadap current_stock.
func (r *InventoryRepository) CountAvailableUnits(itemID string) (int, error) {
	var n int
	if err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM inventory_item_units
		WHERE item_id = ? AND status = ? AND deleted_at IS NULL
	`, itemID, string(models.ItemUnitAvailable)).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}
