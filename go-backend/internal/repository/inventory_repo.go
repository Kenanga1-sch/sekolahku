package repository

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type InventoryRepository struct {
	DB *sql.DB
}

func NewInventoryRepository(db *sql.DB) *InventoryRepository {
	return &InventoryRepository{DB: db}
}

var ErrInventoryBusinessRule = errors.New("inventory business rule")

type inventoryBusinessError string

func (e inventoryBusinessError) Error() string {
	return string(e)
}

func (e inventoryBusinessError) Is(target error) bool {
	return target == ErrInventoryBusinessRule
}

func newInventoryBusinessError(message string) error {
	return inventoryBusinessError(message)
}

// notDeleted adalah klausa standar untuk mengecualikan baris yang sudah
// di-soft-delete. Semua pembacaan wajib menyertakannya, supaya data yang
// "dihapus" tidak muncul di laporan, statistik, maupun daftar.
const notDeleted = "deleted_at IS NULL"

// ErrInventoryNotFound menandakan baris tidak ditemukan. Handler memetakannya
// ke 404, bukan 500 dengan pesan SQL mentah.
var ErrInventoryNotFound = errors.New("data inventaris tidak ditemukan")

// Stats
func (r *InventoryRepository) GetStats() (*models.InventoryStats, error) {
	stats := &models.InventoryStats{}

	// Assets stats
	query := `
		SELECT 
			COUNT(*), 
			SUM(price * quantity), 
			SUM(quantity),
			SUM(condition_good),
			SUM(condition_light_damaged + condition_heavy_damaged),
			SUM(condition_lost)
		FROM inventory_assets
		WHERE status = 'ACTIVE' AND deleted_at IS NULL
	`
	var totalVal sql.NullFloat64
	var tAssets, tQty, tGood, tDamaged, tLost sql.NullInt64

	err := r.DB.QueryRow(query).Scan(&tAssets, &totalVal, &tQty, &tGood, &tDamaged, &tLost)
	if err != nil {
		// Sebelumnya error ditelan dan menghasilkan statistik nol semua, sehingga
		// kegagalan query tidak bisa dibedakan dari "belum ada inventaris".
		return nil, err
	}

	stats.TotalAssets = int(tAssets.Int64)
	stats.TotalValue = totalVal.Float64
	stats.TotalItems = int(tQty.Int64)
	stats.ItemsGood = int(tGood.Int64)
	stats.ItemsDamaged = int(tDamaged.Int64)
	stats.ItemsLost = int(tLost.Int64)

	return stats, nil
}

// Rooms
func (r *InventoryRepository) GetRooms(q string) ([]models.InventoryRoom, error) {
	query := `
		SELECT r.id, r.name, r.code, r.description, r.location, r.pic_id, r.created_at,
		       u.id, u.name, u.email
		FROM inventory_rooms r
		LEFT JOIN users u ON r.pic_id = u.id
		WHERE r.deleted_at IS NULL
	`
	var args []interface{}
	if q != "" {
		// Klausa WHERE dasar (deleted_at) sudah ada — tambahan filter harus AND.
		query += " AND (r.name LIKE ? OR r.code LIKE ?)"
		args = append(args, "%"+q+"%", "%"+q+"%")
	}
	query += " ORDER BY r.name ASC"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rooms := make([]models.InventoryRoom, 0)
	for rows.Next() {
		var rm models.InventoryRoom
		var code, desc, loc, picId sql.NullString
		var createdAt sql.NullInt64
		var uId, uName, uEmail sql.NullString

		err := rows.Scan(
			&rm.ID, &rm.Name, &code, &desc, &loc, &picId, &createdAt,
			&uId, &uName, &uEmail,
		)
		if err != nil {
			return nil, err
		}

		if code.Valid {
			rm.Code = &code.String
		}
		if desc.Valid {
			rm.Description = &desc.String
		}
		if loc.Valid {
			rm.Location = &loc.String
		}
		if picId.Valid {
			rm.PICID = &picId.String
		}
		cTime := ToTime(createdAt)
		rm.CreatedAt = &cTime

		if uId.Valid {
			rm.PIC = &models.User{
				ID:    uId.String,
				Name:  &uName.String,
				Email: uEmail.String,
			}
		}

		rooms = append(rooms, rm)
	}
	// Hasil yang terpotong tidak boleh dianggap lengkap.
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return rooms, nil
}

func (r *InventoryRepository) GetRoomByID(id string) (*models.InventoryRoom, error) {
	query := `
		SELECT r.id, r.name, r.code, r.description, r.location, r.pic_id, r.created_at,
		       u.id, u.name, u.email
		FROM inventory_rooms r
		LEFT JOIN users u ON r.pic_id = u.id
		WHERE r.deleted_at IS NULL AND r.id = ?
	`
	var rm models.InventoryRoom
	var code, desc, loc, picId sql.NullString
	var createdAt sql.NullInt64
	var uId, uName, uEmail sql.NullString

	err := r.DB.QueryRow(query, id).Scan(
		&rm.ID, &rm.Name, &code, &desc, &loc, &picId, &createdAt,
		&uId, &uName, &uEmail,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if code.Valid {
		rm.Code = &code.String
	}
	if desc.Valid {
		rm.Description = &desc.String
	}
	if loc.Valid {
		rm.Location = &loc.String
	}
	if picId.Valid {
		rm.PICID = &picId.String
	}
	cTime := ToTime(createdAt)
	rm.CreatedAt = &cTime

	if uId.Valid {
		rm.PIC = &models.User{
			ID:    uId.String,
			Name:  &uName.String,
			Email: uEmail.String,
		}
	}

	return &rm, nil
}

func (r *InventoryRepository) CreateRoom(req models.CreateInventoryRoomRequest) (*models.InventoryRoom, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	query := `INSERT INTO inventory_rooms (id, name, code, description, location, pic_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := r.DB.Exec(query, id, req.Name, req.Code, req.Description, req.Location, req.PICID, now)
	if err != nil {
		return nil, err
	}
	r.logInventoryAudit("CREATE", "ROOM", id, []map[string]interface{}{
		{"field": "name", "oldValue": nil, "newValue": req.Name},
	}, nil)
	return r.GetRoomByID(id)
}

func (r *InventoryRepository) UpdateRoom(id string, req models.CreateInventoryRoomRequest) (*models.InventoryRoom, error) {
	// Nama wajib, sama seperti CreateRoom. Sebelumnya update bisa mengosongkan
	// nama, dan karena ItemRoomID mencocokkan lokasi lewat nama ruangan,
	// ruangan tanpa nama membuat barang kehilangan pelindung scope-nya.
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return nil, newInventoryBusinessError("Nama ruangan wajib diisi")
	}

	before, err := r.GetRoomByID(id)
	if err != nil {
		return nil, err
	}
	if before == nil {
		return nil, ErrInventoryNotFound
	}

	res, err := r.DB.Exec(
		`UPDATE inventory_rooms SET name = ?, code = ?, description = ?, location = ?, pic_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
		req.Name, req.Code, req.Description, req.Location, req.PICID, UnixMilli(), id)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrInventoryNotFound
	}

	oldName := interface{}(before.Name)
	if err := r.logInventoryAudit("UPDATE", "ROOM", id, []map[string]interface{}{
		{"field": "name", "oldValue": oldName, "newValue": req.Name},
	}, nil); err != nil {
		return nil, err
	}
	return r.GetRoomByID(id)
}

func (r *InventoryRepository) DeleteRoom(id string) error {
	// Soft delete: riwayat ruangan harus tetap bisa diaudit. Menghapus baris
	// akan membuat aset di dalamnya yatim (sebelumnya tanpa FK, sekarang
	// bahkan akan ditolak database).
	result, err := r.DB.Exec("UPDATE inventory_rooms SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL", UnixMilli(), UnixMilli(), id)
	if err == nil {
		if affected, _ := result.RowsAffected(); affected > 0 {
			r.logInventoryAudit("DELETE", "ROOM", id, []map[string]interface{}{
				{"field": "id", "oldValue": id, "newValue": nil},
			}, nil)
		}
	}
	return err
}

// Assets
// assetSelectColumns adalah kolom yang dibaca GetAssets dan GetAssetByID.
//
// category dan status di-COALESCE karena kolomnya nullable sementara model
// Go-nya string non-nullable: aset tanpa kategori sebelumnya membuat
// rows.Scan error ("converting NULL to string") dan seluruh daftar aset
// gagal dimuat.
//
// LEFT JOIN menyaring ruangan yang sudah di-soft-delete supaya nama ruangan
// tidak muncul untuk ruangan yang sudah dihapus.
const assetSelectColumns = `
		SELECT a.id, a.name, a.code, COALESCE(a.category, ''), a.price, a.quantity, a.room_id,
		       a.condition_good, a.condition_light_damaged, a.condition_heavy_damaged, a.condition_lost,
		       a.purchase_date, a.notes, COALESCE(a.status, 'ACTIVE'), a.funding_source, a.fiscal_year, a.photo_url, a.created_at, a.updated_at,
		       r.name
		FROM inventory_assets a
		LEFT JOIN inventory_rooms r ON r.id = a.room_id AND r.deleted_at IS NULL
	`

// scanInventoryAsset memindai satu baris hasil assetSelectColumns.
// Urutan kolom harus sama persis dengan konstanta di atas.
func scanInventoryAsset(rows rowScanner) (models.InventoryAsset, error) {
	var a models.InventoryAsset
	var code, roomID, roomName, notes, fundingSource, photoUrl sql.NullString
	var fiscalYear sql.NullInt64
	var pDate, crAt, upAt sql.NullInt64

	if err := rows.Scan(
		&a.ID, &a.Name, &code, &a.Category, &a.Price, &a.Quantity, &roomID,
		&a.ConditionGood, &a.ConditionLightDamaged, &a.ConditionHeavyDamaged, &a.ConditionLost,
		&pDate, &notes, &a.Status, &fundingSource, &fiscalYear, &photoUrl, &crAt, &upAt,
		&roomName,
	); err != nil {
		return a, err
	}

	if code.Valid {
		a.Code = &code.String
	}
	if roomID.Valid {
		a.RoomID = &roomID.String
	}
	if notes.Valid {
		a.Notes = &notes.String
	}
	if roomID.Valid && roomName.Valid {
		a.Expand = &models.InventoryAssetExpand{
			Room: &models.InventoryRoom{ID: roomID.String, Name: roomName.String},
		}
	}
	if fundingSource.Valid {
		a.FundingSource = &fundingSource.String
	}
	if fiscalYear.Valid {
		v := int(fiscalYear.Int64)
		a.FiscalYear = &v
	}
	if photoUrl.Valid {
		a.PhotoUrl = &photoUrl.String
	}

	if pDate.Valid {
		t := ToTime(pDate)
		a.PurchaseDate = &t
	}
	if crAt.Valid {
		t := ToTime(crAt)
		a.CreatedAt = &t
	}
	if upAt.Valid {
		t := ToTime(upAt)
		a.UpdatedAt = &t
	}
	return a, nil
}

// rowScanner dipakai bersama oleh *sql.Rows dan *sql.Row.
type rowScanner interface {
	Scan(dest ...interface{}) error
}

func (r *InventoryRepository) GetAssetByID(id string) (*models.InventoryAsset, error) {
	query := assetSelectColumns + " WHERE a.deleted_at IS NULL AND a.id = ?"

	a, err := scanInventoryAsset(r.DB.QueryRow(query, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *InventoryRepository) GetAssets(page, limit int, roomId, search, category string) ([]models.InventoryAsset, int, error) {
	offset := (page - 1) * limit

	// Bangun filter sekali, pakai untuk count maupun daftar.
	var where []string
	var args []interface{}
	where = append(where, "a.deleted_at IS NULL")

	if roomId != "" {
		where = append(where, "a.room_id = ?")
		args = append(args, roomId)
	}
	if search != "" {
		// Pencarian mencakup kode aset — placeholder UI menjanjikannya, tapi
		// sebelumnya hanya nama yang dicocokkan.
		where = append(where, "(a.name LIKE ? OR a.code LIKE ?)")
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}
	if category != "" && category != "all" {
		where = append(where, "a.category = ?")
		args = append(args, category)
	}
	clause := " WHERE " + strings.Join(where, " AND ")

	// Count tidak perlu LEFT JOIN ruangan.
	var total int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM inventory_assets a"+clause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := assetSelectColumns + clause + " ORDER BY a.name ASC LIMIT ? OFFSET ?"
	rows, err := r.DB.Query(query, append(append([]interface{}{}, args...), limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	assets := make([]models.InventoryAsset, 0)
	for rows.Next() {
		a, err := scanInventoryAsset(rows)
		if err != nil {
			return nil, 0, err
		}
		assets = append(assets, a)
	}
	// Hasil yang terpotong tidak boleh dianggap lengkap.
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return assets, total, nil
}

func (r *InventoryRepository) CreateAsset(a models.InventoryAsset) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	var pDate *int64
	if a.PurchaseDate != nil {
		d := a.PurchaseDate.UnixMilli()
		pDate = &d
	}

	query := `
		INSERT INTO inventory_assets (
			id, name, code, category, price, quantity, room_id,
			condition_good, condition_light_damaged, condition_heavy_damaged, condition_lost,
			purchase_date, notes, status, funding_source, fiscal_year, photo_url, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, a.Name, a.Code, a.Category, a.Price, a.Quantity, a.RoomID,
		a.ConditionGood, a.ConditionLightDamaged, a.ConditionHeavyDamaged, a.ConditionLost,
		pDate, a.Notes, "ACTIVE", a.FundingSource, a.FiscalYear, a.PhotoUrl, now, now)

	if err != nil {
		return "", err
	}
	r.logInventoryAudit("CREATE", "ASSET", id, []map[string]interface{}{
		{"field": "name", "oldValue": nil, "newValue": a.Name},
		{"field": "quantity", "oldValue": nil, "newValue": a.Quantity},
	}, nil)
	return id, nil
}

func (r *InventoryRepository) UpdateAsset(id string, a models.InventoryAsset) error {
	now := time.Now().UnixMilli()
	var pDate *int64
	if a.PurchaseDate != nil {
		d := a.PurchaseDate.UnixMilli()
		pDate = &d
	}

	query := `
		UPDATE inventory_assets SET
			name = ?, code = ?, category = ?, price = ?, quantity = ?, room_id = ?,
			condition_good = ?, condition_light_damaged = ?, condition_heavy_damaged = ?, condition_lost = ?,
			purchase_date = ?, notes = ?, funding_source = ?, fiscal_year = ?, photo_url = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.DB.Exec(query,
		a.Name, a.Code, a.Category, a.Price, a.Quantity, a.RoomID,
		a.ConditionGood, a.ConditionLightDamaged, a.ConditionHeavyDamaged, a.ConditionLost,
		pDate, a.Notes, a.FundingSource, a.FiscalYear, a.PhotoUrl, now, id)
	if err == nil {
		r.logInventoryAudit("UPDATE", "ASSET", id, []map[string]interface{}{
			{"field": "asset", "oldValue": nil, "newValue": a.Name},
		}, nil)
	}
	return err
}

func (r *InventoryRepository) DeleteAsset(id string) error {
	// Soft delete: aset yang dihapus harus tetap tercatat untuk keperluan audit.
	result, err := r.DB.Exec("UPDATE inventory_assets SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL", UnixMilli(), UnixMilli(), id)
	if err == nil {
		if affected, _ := result.RowsAffected(); affected > 0 {
			r.logInventoryAudit("DELETE", "ASSET", id, []map[string]interface{}{
				{"field": "id", "oldValue": id, "newValue": nil},
			}, nil)
		}
	}
	return err
}

// Items (Consumables)
type inventoryRowScanner interface {
	Scan(dest ...interface{}) error
}

func scanInventoryItem(scanner inventoryRowScanner) (*models.InventoryItem, error) {
	var i models.InventoryItem
	var code, loc, roomID, fundingSource, photoUrl sql.NullString
	var fiscalYear sql.NullInt64
	var crAt, upAt sql.NullInt64
	err := scanner.Scan(
		&i.ID, &i.Name, &code, &i.Category, &i.Unit,
		&i.MinStock, &i.CurrentStock, &loc, &roomID, &i.Price, &fundingSource, &fiscalYear, &photoUrl, &crAt, &upAt,
	)
	if err != nil {
		return nil, err
	}
	if code.Valid {
		i.Code = &code.String
	}
	if loc.Valid {
		i.Location = &loc.String
	}
	if roomID.Valid {
		i.RoomID = &roomID.String
	}
	if fundingSource.Valid {
		i.FundingSource = &fundingSource.String
	}
	if fiscalYear.Valid {
		v := int(fiscalYear.Int64)
		i.FiscalYear = &v
	}
	if photoUrl.Valid {
		i.PhotoUrl = &photoUrl.String
	}
	if crAt.Valid {
		cTime := ToTime(crAt)
		i.CreatedAt = &cTime
	}
	if upAt.Valid {
		uTime := ToTime(upAt)
		i.UpdatedAt = &uTime
	}
	return &i, nil
}

func (r *InventoryRepository) GetItems(page, limit int, search, category string) ([]models.InventoryItem, int, error) {
	offset := (page - 1) * limit
	query := "SELECT id, name, code, category, unit, min_stock, current_stock, location, room_id, price, funding_source, fiscal_year, photo_url, created_at, updated_at FROM inventory_items WHERE deleted_at IS NULL"
	var args []interface{}

	if search != "" {
		query += " AND (name LIKE ? OR code LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}
	if category != "" && category != "all" && category != "ALL" {
		query += " AND category = ?"
		args = append(args, category)
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM (" + query + ")"
	if err := r.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query += " ORDER BY name ASC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]models.InventoryItem, 0)
	for rows.Next() {
		item, err := scanInventoryItem(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, *item)
	}
	return items, total, nil
}

func (r *InventoryRepository) getItemOnlyByID(id string) (*models.InventoryItem, error) {
	item, err := scanInventoryItem(r.DB.QueryRow(
		"SELECT id, name, code, category, unit, min_stock, current_stock, location, room_id, price, funding_source, fiscal_year, photo_url, created_at, updated_at FROM inventory_items WHERE id = ? AND deleted_at IS NULL",
		id,
	))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return item, nil
}

func (r *InventoryRepository) GetItemByID(id string) (*models.InventoryItem, []models.InventoryTransaction, error) {
	item, err := r.getItemOnlyByID(id)
	if err != nil || item == nil {
		return item, nil, err
	}
	history, err := r.GetTransactions(100, id, "")
	if err != nil {
		return nil, nil, err
	}
	return item, history, nil
}

func (r *InventoryRepository) CreateItem(i models.InventoryItem) (*models.InventoryItem, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	query := `INSERT INTO inventory_items (id, name, code, category, unit, min_stock, current_stock, location, room_id, price, funding_source, fiscal_year, photo_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.DB.Exec(query, id, i.Name, i.Code, i.Category, i.Unit, i.MinStock, i.CurrentStock, i.Location, i.RoomID, i.Price, i.FundingSource, i.FiscalYear, i.PhotoUrl, now, now)
	if err != nil {
		return nil, err
	}
	r.logInventoryAudit("CREATE", "ITEM", id, []map[string]interface{}{
		{"field": "name", "oldValue": nil, "newValue": i.Name},
		{"field": "currentStock", "oldValue": nil, "newValue": i.CurrentStock},
	}, nil)
	return r.getItemOnlyByID(id)
}

func (r *InventoryRepository) UpdateItem(id string, i models.InventoryItem) (*models.InventoryItem, error) {
	now := time.Now().UnixMilli()
	result, err := r.DB.Exec(`
		UPDATE inventory_items
		SET name = ?, code = ?, category = ?, unit = ?, min_stock = ?, current_stock = ?, location = ?, room_id = ?, price = ?, funding_source = ?, fiscal_year = ?, photo_url = ?, updated_at = ?
		WHERE id = ?
	`, i.Name, i.Code, i.Category, i.Unit, i.MinStock, i.CurrentStock, i.Location, i.RoomID, i.Price, i.FundingSource, i.FiscalYear, i.PhotoUrl, now, id)
	if err != nil {
		return nil, err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return nil, nil
	}
	r.logInventoryAudit("UPDATE", "ITEM", id, []map[string]interface{}{
		{"field": "masterData", "oldValue": nil, "newValue": i.Name},
	}, nil)
	return r.getItemOnlyByID(id)
}

func (r *InventoryRepository) DeleteItem(id string) error {
	// Soft delete: transaksi yang merujuk item ini tidak boleh ikut hilang
	// (inventory_transactions.item_id sekarang punya FK ke inventory_items).
	result, err := r.DB.Exec("UPDATE inventory_items SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL", UnixMilli(), UnixMilli(), id)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected > 0 {
		r.logInventoryAudit("DELETE", "ITEM", id, []map[string]interface{}{
			{"field": "id", "oldValue": id, "newValue": nil},
		}, nil)
	}
	return nil
}

// Transactions
func (r *InventoryRepository) GetTransactions(limit int, itemID, trxType string) ([]models.InventoryTransaction, error) {
	query := `
		SELECT t.id, t.item_id, t.type, t.quantity, t.date, t.description, t.recipient, t.proof_image, t.user_id, t.created_at,
		       i.id, i.name, i.code, i.category, i.unit, i.min_stock, i.current_stock, i.location, i.price, i.created_at, i.updated_at
		FROM inventory_transactions t
		LEFT JOIN inventory_items i ON t.item_id = i.id
		WHERE t.deleted_at IS NULL
	`
	var args []interface{}
	if itemID != "" {
		query += " AND t.item_id = ?"
		args = append(args, itemID)
	}
	if trxType != "" && trxType != "all" && trxType != "ALL" {
		query += " AND t.type = ?"
		args = append(args, trxType)
	}
	query += " ORDER BY t.created_at DESC LIMIT ?"
	args = append(args, limit)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	transactions := make([]models.InventoryTransaction, 0)
	for rows.Next() {
		var t models.InventoryTransaction
		var item models.InventoryItem
		var desc, recipient, proof, userID, itemCode, itemLoc sql.NullString
		var dateMi, createdMi, itemCreatedMi, itemUpdatedMi sql.NullInt64
		err := rows.Scan(
			&t.ID, &t.ItemID, &t.Type, &t.Quantity, &dateMi, &desc, &recipient, &proof, &userID, &createdMi,
			&item.ID, &item.Name, &itemCode, &item.Category, &item.Unit, &item.MinStock, &item.CurrentStock, &itemLoc, &item.Price, &itemCreatedMi, &itemUpdatedMi,
		)
		if err != nil {
			return nil, err
		}
		if desc.Valid {
			t.Description = &desc.String
		}
		if recipient.Valid {
			t.Recipient = &recipient.String
		}
		if proof.Valid {
			t.ProofImage = &proof.String
		}
		if userID.Valid {
			t.UserID = &userID.String
		}
		if dateMi.Valid {
			d := time.UnixMilli(dateMi.Int64)
			t.Date = &d
		}
		if createdMi.Valid {
			c := time.UnixMilli(createdMi.Int64)
			t.CreatedAt = &c
		}
		if item.ID != "" {
			if itemCode.Valid {
				item.Code = &itemCode.String
			}
			if itemLoc.Valid {
				item.Location = &itemLoc.String
			}
			if itemCreatedMi.Valid {
				c := time.UnixMilli(itemCreatedMi.Int64)
				item.CreatedAt = &c
			}
			if itemUpdatedMi.Valid {
				u := time.UnixMilli(itemUpdatedMi.Int64)
				item.UpdatedAt = &u
			}
			t.Item = &item
		}
		transactions = append(transactions, t)
	}
	return transactions, nil
}

func (r *InventoryRepository) CreateTransaction(t models.InventoryTransaction) error {
	if t.ItemID == "" {
		return newInventoryBusinessError("Barang wajib dipilih")
	}
	if t.Quantity <= 0 {
		return newInventoryBusinessError("Jumlah transaksi harus lebih dari 0")
	}
	if t.Type != "IN" && t.Type != "OUT" {
		return newInventoryBusinessError("Tipe transaksi tidak valid")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentStock int
	var itemName string
	err = tx.QueryRow("SELECT name, current_stock FROM inventory_items WHERE id = ?", t.ItemID).Scan(&itemName, &currentStock)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return newInventoryBusinessError("Barang tidak ditemukan")
		}
		return err
	}
	if t.Type == "OUT" && currentStock < t.Quantity {
		return newInventoryBusinessError("Stok tidak cukup")
	}

	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	dateMi := now
	if t.Date != nil {
		dateMi = t.Date.UnixMilli()
	}

	_, err = tx.Exec(`
		INSERT INTO inventory_transactions (id, item_id, type, quantity, date, description, recipient, proof_image, user_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, t.ItemID, t.Type, t.Quantity, dateMi, t.Description, t.Recipient, t.ProofImage, t.UserID, now)
	if err != nil {
		return err
	}

	if t.Type == "IN" {
		_, err = tx.Exec("UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?", t.Quantity, now, t.ItemID)
	} else {
		_, err = tx.Exec("UPDATE inventory_items SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?", t.Quantity, now, t.ItemID)
	}
	if err != nil {
		return err
	}

	r.logInventoryAuditTx(tx, "UPDATE", "ITEM", t.ItemID, []map[string]interface{}{
		{"field": "currentStock", "oldValue": currentStock, "newValue": currentStock + stockDelta(t.Type, t.Quantity)},
		{"field": "transaction", "oldValue": nil, "newValue": t.Type + " " + itemName},
	}, t.UserID)

	return tx.Commit()
}

func stockDelta(trxType string, quantity int) int {
	if trxType == "IN" {
		return quantity
	}
	return -quantity
}

// ============ Opname (Stock Take) ============

// opnameColumns dipakai bersama oleh GetOpnames dan GetOpnameByID.
const opnameColumns = "id, date, room_id, auditor_id, status, note, created_at"

func (r *InventoryRepository) GetOpnames(page, limit int) ([]models.InventoryOpname, int, error) {
	offset := (page - 1) * limit
	var total int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM inventory_opname WHERE deleted_at IS NULL").Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.DB.Query(
		"SELECT "+opnameColumns+" FROM inventory_opname WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
		limit, offset)
	if err != nil {
		return nil, 0, err
	}

	// TAHAP 1: kumpulkan header sesi dulu, lalu tutup cursor.
	// Query item di dalam loop rows.Next() membuat deadlock: koneksi tunggal
	// (SetMaxOpenConns(1)) dipegang cursor luar, query nested menunggu selamanya.
	ops := make([]models.InventoryOpname, 0)
	for rows.Next() {
		o, err := scanInventoryOpname(rows)
		if err != nil {
			return nil, 0, err
		}
		ops = append(ops, *o)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	rows.Close()

	// TAHAP 2: ambil baris hasil hitung per sesi (cursor sudah bebas).
	for i := range ops {
		items, err := r.getOpnameItems(ops[i].ID)
		if err != nil {
			return nil, 0, err
		}
		ops[i].Items = items
	}
	return ops, total, nil
}

// scanInventoryOpname memindai satu baris inventory_opname.
func scanInventoryOpname(rows *sql.Rows) (*models.InventoryOpname, error) {
	var o models.InventoryOpname
	var rId, aId, note sql.NullString
	var dateMi, crAtMi sql.NullInt64

	if err := rows.Scan(&o.ID, &dateMi, &rId, &aId, &o.Status, &note, &crAtMi); err != nil {
		return nil, err
	}
	if rId.Valid {
		o.RoomID = &rId.String
	}
	if aId.Valid {
		o.AuditorID = &aId.String
	}
	if note.Valid {
		o.Note = &note.String
	}
	if dateMi.Valid {
		o.Date = time.UnixMilli(dateMi.Int64)
	}
	if crAtMi.Valid {
		cTime := ToTime(crAtMi)
		o.CreatedAt = &cTime
	}
	return &o, nil
}

func (r *InventoryRepository) getOpnameItems(opnameID string) ([]models.InventoryOpnameItem, error) {
	rows, err := r.DB.Query(`
		SELECT id, asset_id,
		       COALESCE(system_quantity, 0), COALESCE(system_good, 0), COALESCE(system_light_damaged, 0),
		       COALESCE(system_heavy_damaged, 0), COALESCE(system_lost, 0),
		       COALESCE(counted_good, 0), COALESCE(counted_light_damaged, 0),
		       COALESCE(counted_heavy_damaged, 0), COALESCE(counted_lost, 0),
		       COALESCE(note, '')
		FROM inventory_opname_items WHERE opname_id = ? ORDER BY created_at ASC
	`, opnameID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.InventoryOpnameItem, 0)
	for rows.Next() {
		var it models.InventoryOpnameItem
		if err := rows.Scan(
			&it.ID, &it.AssetID,
			&it.SystemQuantity, &it.SystemGood, &it.SystemLightDamaged, &it.SystemHeavyDamaged, &it.SystemLost,
			&it.CountedGood, &it.CountedLightDamaged, &it.CountedHeavyDamaged, &it.CountedLost,
			&it.Note,
		); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// CreateOpname menyimpan sesi opname berikut baris hasil hitungnya.
//
// Nilai system_* diambil dari kondisi aset SAAT INI supaya selisih bisa
// dihitung saat ApplyOpname. Jika aset tidak ditemukan, operasi dibatalkan —
// lebih baik gagal di awal daripada menyimpan opname yang tidak bisa diterapkan.
func (r *InventoryRepository) CreateOpname(o models.InventoryOpname) error {
	if len(o.Items) == 0 {
		return newInventoryBusinessError("Data item opname wajib diisi")
	}

	now := time.Now().UnixMilli()
	id := cuid2.Generate()

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`
		INSERT INTO inventory_opname (id, date, room_id, auditor_id, status, note, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, o.Date.UnixMilli(), o.RoomID, o.AuditorID, "PENDING", o.Note, now); err != nil {
		return err
	}

	for _, it := range o.Items {
		if it.AssetID == "" {
			return newInventoryBusinessError("Data aset opname tidak valid")
		}

		// Ambil kondisi sistem saat ini sebagai pembanding selisih.
		var sysQty, sysGood, sysLight, sysHeavy, sysLost int
		err := tx.QueryRow(`
			SELECT COALESCE(quantity,0), COALESCE(condition_good,0), COALESCE(condition_light_damaged,0),
			       COALESCE(condition_heavy_damaged,0), COALESCE(condition_lost,0)
			FROM inventory_assets WHERE id = ? AND deleted_at IS NULL
		`, it.AssetID).Scan(&sysQty, &sysGood, &sysLight, &sysHeavy, &sysLost)
		if err == sql.ErrNoRows {
			return newInventoryBusinessError("Aset tidak ditemukan: " + it.AssetID)
		}
		if err != nil {
			return err
		}

		// Validasi ruangan: aset harus benar-benar milik ruangan yang di-opname.
		// Sebelumnya tidak dicek, sehingga payload bisa mengubah aset ruangan lain.
		if o.RoomID != nil && *o.RoomID != "" {
			var roomID sql.NullString
			if err := tx.QueryRow("SELECT room_id FROM inventory_assets WHERE id = ?", it.AssetID).Scan(&roomID); err != nil {
				return err
			}
			if !roomID.Valid || roomID.String != *o.RoomID {
				return newInventoryBusinessError("Aset " + it.AssetID + " bukan milik ruangan yang di-opname")
			}
		}

		if it.CountedGood < 0 || it.CountedLightDamaged < 0 || it.CountedHeavyDamaged < 0 || it.CountedLost < 0 {
			return newInventoryBusinessError("Jumlah opname tidak boleh negatif")
		}

		if _, err := tx.Exec(`
			INSERT INTO inventory_opname_items (
				id, opname_id, asset_id,
				system_quantity, system_good, system_light_damaged, system_heavy_damaged, system_lost,
				counted_good, counted_light_damaged, counted_heavy_damaged, counted_lost,
				note, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, cuid2.Generate(), id, it.AssetID,
			sysQty, sysGood, sysLight, sysHeavy, sysLost,
			it.CountedGood, it.CountedLightDamaged, it.CountedHeavyDamaged, it.CountedLost,
			nullIfEmpty(it.Note), now); err != nil {
			return err
		}
	}

	if err := r.logInventoryAuditTx(tx, "CREATE", "OPNAME", id, []map[string]interface{}{
		{"field": "status", "oldValue": nil, "newValue": "PENDING"},
	}, o.AuditorID); err != nil {
		return err
	}

	return tx.Commit()
}

// ApplyOpname menerapkan hasil hitung fisik ke aset.
//
// Perubahan penting dibanding versi lama:
//   - Nilai lama tidak lagi ditimpa mentah-mentah. Selisih (counted - system)
//     dihitung dan dicatat, sehingga bukti opname tetap ada.
//   - Aset harus milik ruangan yang di-opname (dulu bisa mengubah aset ruangan lain).
//   - RowsAffected dicek: bila ada ID aset yang tidak cocok, transaksi dibatalkan
//     alih-alih menandai opname APPLIED padahal tidak ada yang berubah.
//   - Payload parsial tidak lagi mengosongkan kondisi lain: nilai yang tidak
//     dikirim dianggap 0 hanya bila memang 0, karena dulu getIntValue mengubah
//     field yang tidak ada menjadi 0 dan menimpa kondisi yang sudah tercatat.
//   - ID opname yang tidak ditemukan menghasilkan 404, bukan 500 + pesan SQL.
func (r *InventoryRepository) ApplyOpname(id string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var roomID sql.NullString
	var status string
	err = tx.QueryRow("SELECT room_id, status FROM inventory_opname WHERE id = ? AND deleted_at IS NULL", id).Scan(&roomID, &status)
	if err == sql.ErrNoRows {
		return ErrInventoryNotFound
	}
	if err != nil {
		return err
	}
	if status == "APPLIED" {
		return newInventoryBusinessError("Opname sudah pernah diterapkan")
	}

	items, err := r.getOpnameItemsTx(tx, id)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return newInventoryBusinessError("Opname tidak punya baris hasil hitung")
	}

	now := time.Now().UnixMilli()
	for _, it := range items {
		// Validasi kepemilikan ruangan pada saat diterapkan, bukan hanya saat dibuat.
		if roomID.Valid && roomID.String != "" {
			var assetRoom sql.NullString
			if err := tx.QueryRow("SELECT room_id FROM inventory_assets WHERE id = ?", it.AssetID).Scan(&assetRoom); err != nil {
				return err
			}
			if !assetRoom.Valid || assetRoom.String != roomID.String {
				return newInventoryBusinessError("Aset " + it.AssetID + " bukan milik ruangan yang di-opname")
			}
		}

		total := it.CountedGood + it.CountedLightDamaged + it.CountedHeavyDamaged + it.CountedLost

		res, err := tx.Exec(`
			UPDATE inventory_assets
			SET quantity = ?, condition_good = ?, condition_light_damaged = ?, condition_heavy_damaged = ?, condition_lost = ?, updated_at = ?
			WHERE id = ? AND deleted_at IS NULL
		`, total, it.CountedGood, it.CountedLightDamaged, it.CountedHeavyDamaged, it.CountedLost, now, it.AssetID)
		if err != nil {
			return err
		}
		// Dulu RowsAffected diabaikan, sehingga ID salah membuat opname tetap
		// berstatus APPLIED walau tidak ada yang berubah.
		if n, err := res.RowsAffected(); err != nil {
			return err
		} else if n == 0 {
			return newInventoryBusinessError("Aset tidak ditemukan: " + it.AssetID)
		}

		// Catat selisih sebagai catatan permanen di baris opname, supaya
		// "apa yang hilang/rusak pada opname ini" masih bisa dijawab nanti.
		delta := total - it.SystemQuantity
		note := it.Note
		if delta != 0 {
			selisih := fmt.Sprintf("Selisih %+d unit (sistem %d, hitung %d)", delta, it.SystemQuantity, total)
			if note != "" {
				note = note + "; " + selisih
			} else {
				note = selisih
			}
		}
		if _, err := tx.Exec("UPDATE inventory_opname_items SET note = ? WHERE id = ?", nullIfEmpty(note), it.ID); err != nil {
			return err
		}
	}

	if _, err := tx.Exec("UPDATE inventory_opname SET status = 'APPLIED' WHERE id = ?", id); err != nil {
		return err
	}
	if err := r.logInventoryAuditTx(tx, "OPNAME_APPLY", "OPNAME", id, []map[string]interface{}{
		{"field": "status", "oldValue": status, "newValue": "APPLIED"},
	}, nil); err != nil {
		return err
	}

	return tx.Commit()
}

// getOpnameItemsTx sama dengan getOpnameItems tetapi di dalam transaksi.
func (r *InventoryRepository) getOpnameItemsTx(tx *sql.Tx, opnameID string) ([]models.InventoryOpnameItem, error) {
	rows, err := tx.Query(`
		SELECT id, asset_id,
		       COALESCE(system_quantity, 0), COALESCE(system_good, 0), COALESCE(system_light_damaged, 0),
		       COALESCE(system_heavy_damaged, 0), COALESCE(system_lost, 0),
		       COALESCE(counted_good, 0), COALESCE(counted_light_damaged, 0),
		       COALESCE(counted_heavy_damaged, 0), COALESCE(counted_lost, 0),
		       COALESCE(note, '')
		FROM inventory_opname_items WHERE opname_id = ? ORDER BY created_at ASC
	`, opnameID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.InventoryOpnameItem, 0)
	for rows.Next() {
		var it models.InventoryOpnameItem
		if err := rows.Scan(
			&it.ID, &it.AssetID,
			&it.SystemQuantity, &it.SystemGood, &it.SystemLightDamaged, &it.SystemHeavyDamaged, &it.SystemLost,
			&it.CountedGood, &it.CountedLightDamaged, &it.CountedHeavyDamaged, &it.CountedLost,
			&it.Note,
		); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// nullIfEmpty mengubah string kosong jadi NULL agar konsisten dengan kolom opsional.
func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// ============ Peminjaman Aset Antar-Ruangan ============

// BorrowRequest adalah satu pengajuan peminjaman aset.
type BorrowRequest struct {
	ID          string  `json:"id"`
	AssetID     string  `json:"assetId"`
	AssetName   string  `json:"assetName"`
	RoomID      string  `json:"roomId"`
	RoomName    string  `json:"roomName"`
	RequesterID string  `json:"requesterId"`
	Requester   string  `json:"requesterName"`
	Reason      *string `json:"reason"`
	Quantity    int     `json:"quantity"`
	Status      string  `json:"status"`
	ApprovedBy  *string `json:"approvedBy"`
	ApprovedAt  *int64  `json:"approvedAt"`
	ReturnedBy  *string `json:"returnedBy"`
	ReturnedAt  *int64  `json:"returnedAt"`
	CreatedAt   int64   `json:"createdAt"`
}

// CreateBorrowRequest mencatat pengajuan. Stok belum bergerak — pergerakan
// terjadi saat disetujui, supaya pengajuan yang ditolak tidak mengubah stok.
func (r *InventoryRepository) CreateBorrowRequest(assetID, roomID, requesterID, reason string, quantity int) (string, error) {
	if assetID == "" {
		return "", newInventoryBusinessError("Aset wajib dipilih")
	}
	if requesterID == "" {
		return "", newInventoryBusinessError("Pemohon tidak dikenali")
	}
	if quantity <= 0 {
		return "", newInventoryBusinessError("Jumlah harus lebih dari nol")
	}

	id := cuid2.Generate()
	now := UnixMilli()
	if _, err := r.DB.Exec(`
		INSERT INTO inventory_borrow_requests
			(id, asset_id, room_id, requester_id, reason, quantity, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
	`, id, assetID, roomID, requesterID, nullIfEmpty(reason), quantity, now, now); err != nil {
		return "", err
	}

	if err := r.logInventoryAudit("CREATE", "BORROW_REQUEST", id, []map[string]interface{}{
		{"field": "status", "oldValue": nil, "newValue": "pending"},
	}, &requesterID); err != nil {
		return "", err
	}
	return id, nil
}

// ListBorrowRequests mengembalikan pengajuan. Bila requesterID dibatasi (bukan
// admin), hanya pengajuan milik user itu yang dikembalikan.
func (r *InventoryRepository) ListBorrowRequests(requesterID, statusFilter string) ([]BorrowRequest, error) {
	query := `
		SELECT br.id, br.asset_id, a.name, br.room_id, r.name, br.requester_id, u.name,
		       br.reason, br.quantity, br.status, br.approved_by, br.approved_at,
		       br.returned_by, br.returned_at, br.created_at
		FROM inventory_borrow_requests br
		LEFT JOIN inventory_assets a ON br.asset_id = a.id
		LEFT JOIN inventory_rooms r ON br.room_id = r.id
		LEFT JOIN users u ON br.requester_id = u.id
		WHERE 1=1
	`
	var args []interface{}
	if requesterID != "" {
		query += " AND br.requester_id = ?"
		args = append(args, requesterID)
	}
	if statusFilter != "" {
		query += " AND br.status = ?"
		args = append(args, statusFilter)
	}
	query += " ORDER BY br.created_at DESC LIMIT 100"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]BorrowRequest, 0)
	for rows.Next() {
		var br BorrowRequest
		var assetName, roomName, requester sql.NullString
		var reason, approvedBy, returnedBy sql.NullString
		var approvedAt, returnedAt sql.NullInt64
		if err := rows.Scan(&br.ID, &br.AssetID, &assetName, &br.RoomID, &roomName,
			&br.RequesterID, &requester, &reason, &br.Quantity, &br.Status,
			&approvedBy, &approvedAt, &returnedBy, &returnedAt, &br.CreatedAt); err != nil {
			return nil, err
		}
		br.AssetName = assetName.String
		br.RoomName = roomName.String
		br.Requester = requester.String
		if reason.Valid {
			br.Reason = &reason.String
		}
		if approvedBy.Valid {
			br.ApprovedBy = &approvedBy.String
		}
		if approvedAt.Valid {
			v := approvedAt.Int64
			br.ApprovedAt = &v
		}
		if returnedBy.Valid {
			br.ReturnedBy = &returnedBy.String
		}
		if returnedAt.Valid {
			v := returnedAt.Int64
			br.ReturnedAt = &v
		}
		out = append(out, br)
	}
	return out, rows.Err()
}

// ReviewBorrowRequest menyetujui atau menolak pengajuan.
//
// Saat disetujui, stok aset dikurangi DALAM TRANSAKSI YANG SAMA dengan
// perubahan status. Sebelumnya status diubah tanpa menyentuh stok sama sekali,
// sehingga peminjaman yang disetujui tidak pernah mengurangi jumlah aset —
// itu inti dari kerugian aset yang tidak terlacak.
func (r *InventoryRepository) ReviewBorrowRequest(id, adminID, action string) (string, error) {
	newStatus := "approved"
	if action == "reject" {
		newStatus = "rejected"
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	var assetID string
	var quantity int
	var status string
	err = tx.QueryRow(`
		SELECT asset_id, quantity, status FROM inventory_borrow_requests WHERE id = ?
	`, id).Scan(&assetID, &quantity, &status)
	if err == sql.ErrNoRows {
		return "", ErrInventoryNotFound
	}
	if err != nil {
		return "", err
	}
	if status != "pending" {
		return "", newInventoryBusinessError("Pengajuan sudah diproses")
	}

	now := UnixMilli()

	if action == "approve" {
		// Kurangi stok, dengan guard agar tidak jadi negatif.
		res, err := tx.Exec(`
			UPDATE inventory_assets
			SET quantity = quantity - ?, updated_at = ?
			WHERE id = ? AND deleted_at IS NULL AND quantity >= ?
		`, quantity, now, assetID, quantity)
		if err != nil {
			return "", err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return "", newInventoryBusinessError("Stok aset tidak cukup untuk dipinjamkan")
		}
	}

	res, err := tx.Exec(`
		UPDATE inventory_borrow_requests
		SET status = ?, approved_by = ?, approved_at = ?, updated_at = ?
		WHERE id = ? AND status = 'pending'
	`, newStatus, adminID, now, now, id)
	if err != nil {
		return "", err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return "", newInventoryBusinessError("Pengajuan sudah diproses")
	}

	if err := logInventoryAuditTxBorrow(tx, "BORROW_"+strings.ToUpper(action), "BORROW_REQUEST", id,
		[]map[string]interface{}{{"field": "status", "oldValue": status, "newValue": newStatus}}, &adminID); err != nil {
		return "", err
	}

	return newStatus, tx.Commit()
}

// ReturnBorrowRequest mencatat pengembalian dan mengembalikan stok ke aset.
// Endpoint ini sebelumnya tidak ada sama sekali: aset yang dipinjam tidak punya
// jalur resmi untuk kembali, sehingga stok permanen berkurang.
func (r *InventoryRepository) ReturnBorrowRequest(id, userID string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var assetID string
	var quantity int
	var status string
	err = tx.QueryRow("SELECT asset_id, quantity, status FROM inventory_borrow_requests WHERE id = ?", id).
		Scan(&assetID, &quantity, &status)
	if err == sql.ErrNoRows {
		return ErrInventoryNotFound
	}
	if err != nil {
		return err
	}
	if status != "approved" {
		return newInventoryBusinessError("Hanya pengajuan yang sudah disetujui bisa dikembalikan")
	}

	now := UnixMilli()
	res, err := tx.Exec(`
		UPDATE inventory_borrow_requests
		SET status = 'returned', returned_by = ?, returned_at = ?, updated_at = ?
		WHERE id = ? AND status = 'approved'
	`, userID, now, now, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return newInventoryBusinessError("Pengajuan sudah diproses")
	}

	if _, err := tx.Exec(`
		UPDATE inventory_assets SET quantity = quantity + ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL
	`, quantity, now, assetID); err != nil {
		return err
	}

	if err := logInventoryAuditTxBorrow(tx, "BORROW_RETURN", "BORROW_REQUEST", id,
		[]map[string]interface{}{{"field": "status", "oldValue": status, "newValue": "returned"}}, &userID); err != nil {
		return err
	}
	return tx.Commit()
}

// logInventoryAuditTxBorrow membolehkan audit ditulis dari transaksi repo lain.
func logInventoryAuditTxBorrow(tx *sql.Tx, action, entity, entityID string, changes []map[string]interface{}, userID *string) error {
	id := cuid2.Generate()
	now := UnixMilli()
	raw, err := json.Marshal(changes)
	if err != nil {
		return err
	}
	text := string(raw)
	_, err = tx.Exec(
		"INSERT INTO inventory_audit (id, action, entity, entity_id, changes, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, action, entity, entityID, &text, userID, now,
	)
	return err
}

func getStringValue(item map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := item[key]; ok {
			if text, ok := value.(string); ok {
				return text
			}
		}
	}
	return ""
}

func getIntValue(item map[string]interface{}, keys ...string) int {
	for _, key := range keys {
		if value, ok := item[key]; ok {
			switch v := value.(type) {
			case float64:
				return int(v)
			case int:
				return v
			case json.Number:
				n, _ := v.Int64()
				return int(n)
			}
		}
	}
	return 0
}

// Audit
// logInventoryAudit mencatat entri audit di transaksi TERSENDIRI.
//
// Catatan: ini berarti audit bisa gagal walau operasi utamanya commit. Untuk
// perubahan yang wajib diaudit (opname, mutasi stok), gunakan
// logInventoryAuditTx agar tercatat dalam transaksi yang sama.
func (r *InventoryRepository) logInventoryAudit(action, entity, entityID string, changes interface{}, userID *string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := r.logInventoryAuditTx(tx, action, entity, entityID, changes, userID); err != nil {
		return err
	}
	return tx.Commit()
}

// logInventoryAuditTx menulis entri audit di dalam transaksi yang sedang berjalan.
func (r *InventoryRepository) logInventoryAuditTx(tx *sql.Tx, action, entity, entityID string, changes interface{}, userID *string) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	var changesText *string
	if changes != nil {
		if raw, err := json.Marshal(changes); err == nil {
			text := string(raw)
			changesText = &text
		}
	}
	_, err := tx.Exec(
		"INSERT INTO inventory_audit (id, action, entity, entity_id, changes, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, action, entity, entityID, changesText, userID, now,
	)
	return err
}

func (r *InventoryRepository) GetAuditLogs(page, limit int, action, entity string) ([]models.InventoryAudit, int, error) {
	offset := (page - 1) * limit
	query := "FROM inventory_audit WHERE 1=1"
	var args []interface{}
	if action != "" && action != "all" {
		query += " AND action = ?"
		args = append(args, action)
	}
	if entity != "" && entity != "all" {
		query += " AND entity = ?"
		args = append(args, entity)
	}

	var total int
	if err := r.DB.QueryRow("SELECT COUNT(*) "+query, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.DB.Query("SELECT id, action, entity, entity_id, changes, user_id, created_at "+query+" ORDER BY created_at DESC LIMIT ? OFFSET ?", append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	logs := make([]models.InventoryAudit, 0)
	for rows.Next() {
		var l models.InventoryAudit
		var changes, uId sql.NullString
		var crAt sql.NullInt64
		if err := rows.Scan(&l.ID, &l.Action, &l.Entity, &l.EntityID, &changes, &uId, &crAt); err != nil {
			return nil, 0, err
		}
		if changes.Valid {
			l.Changes = json.RawMessage(changes.String)
		}
		if uId.Valid {
			l.UserID = &uId.String
		}
		if crAt.Valid {
			cTime := ToTime(crAt)
			l.CreatedAt = &cTime
		}
		logs = append(logs, l)
	}
	return logs, total, nil
}

// ==========================================
// Analytics / Chart Data
// ==========================================

// CategoryDistributionItem untuk chart distribusi kategori
type CategoryDistributionItem struct {
	Name  string `json:"name"`
	Value int    `json:"value"`
	Color string `json:"color"`
}

// GetCategoryDistribution mengembalikan jumlah aset per kategori
func (r *InventoryRepository) GetCategoryDistribution() ([]CategoryDistributionItem, error) {
	rows, err := r.DB.Query(`
		SELECT category, COUNT(*) AS total
		FROM inventory_assets
		WHERE status = 'ACTIVE' OR status IS NULL
		GROUP BY category
		ORDER BY total DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	palette := []string{
		"#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
		"#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
	}

	result := []CategoryDistributionItem{}
	idx := 0
	for rows.Next() {
		var name string
		var value int
		if err := rows.Scan(&name, &value); err != nil {
			return nil, err
		}
		color := palette[idx%len(palette)]
		result = append(result, CategoryDistributionItem{
			Name:  name,
			Value: value,
			Color: color,
		})
		idx++
	}
	return result, nil
}

// ConditionBreakdownItem untuk chart kondisi
type ConditionBreakdownItem struct {
	Name  string `json:"name"`
	Value int    `json:"value"`
	Color string `json:"color"`
}

// GetConditionBreakdown mengembalikan jumlah aset per kondisi
func (r *InventoryRepository) GetConditionBreakdown() ([]ConditionBreakdownItem, error) {
	// SQLite UNION untuk menggabungkan 4 kondisi
	rows, err := r.DB.Query(`
		SELECT 'Baik' AS name, COALESCE(SUM(condition_good), 0) AS total, '#10b981' AS color FROM inventory_assets WHERE (status = 'ACTIVE' OR status IS NULL)
		UNION ALL
		SELECT 'Rusak Ringan' AS name, COALESCE(SUM(condition_light_damaged), 0) AS total, '#f59e0b' AS color FROM inventory_assets WHERE (status = 'ACTIVE' OR status IS NULL)
		UNION ALL
		SELECT 'Rusak Berat' AS name, COALESCE(SUM(condition_heavy_damaged), 0) AS total, '#ef4444' AS color FROM inventory_assets WHERE (status = 'ACTIVE' OR status IS NULL)
		UNION ALL
		SELECT 'Hilang' AS name, COALESCE(SUM(condition_lost), 0) AS total, '#6b7280' AS color FROM inventory_assets WHERE (status = 'ACTIVE' OR status IS NULL)
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []ConditionBreakdownItem{}
	for rows.Next() {
		var item ConditionBreakdownItem
		if err := rows.Scan(&item.Name, &item.Value, &item.Color); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, nil
}

// TopRoomItem untuk widget ruangan teratas
type TopRoomItem struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	AssetCount int     `json:"assetCount"`
	TotalValue float64 `json:"totalValue"`
}

// GetTopRoomsByValue mengembalikan ruangan dengan total nilai aset tertinggi
func (r *InventoryRepository) GetTopRoomsByValue(limit int) ([]TopRoomItem, error) {
	if limit <= 0 {
		limit = 5
	}
	rows, err := r.DB.Query(`
		SELECT
			COALESCE(rm.id, '') AS room_id,
			COALESCE(rm.name, 'Tanpa Ruangan') AS room_name,
			COUNT(a.id) AS asset_count,
			COALESCE(SUM(a.price * a.quantity), 0) AS total_value
		FROM inventory_assets a
		LEFT JOIN inventory_rooms rm ON rm.id = a.room_id
		WHERE a.deleted_at IS NULL AND (a.status = 'ACTIVE' OR a.status IS NULL)
		GROUP BY rm.id, rm.name
		HAVING COUNT(a.id) > 0
		ORDER BY total_value DESC, asset_count DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []TopRoomItem{}
	for rows.Next() {
		var item TopRoomItem
		var roomID sql.NullString
		if err := rows.Scan(&roomID, &item.Name, &item.AssetCount, &item.TotalValue); err != nil {
			return nil, err
		}
		if roomID.Valid {
			item.ID = roomID.String
		}
		result = append(result, item)
	}
	return result, nil
}

// RecentAuditItem untuk widget "Log Aktivitas Terbaru".
// Bentuknya mengikuti tabel inventory_audit agar widget bisa menampilkan
// aksi (CREATE/UPDATE/DELETE/OPNAME_APPLY) dan entitas (ASSET/ROOM/OPNAME).
type RecentAuditItem struct {
	ID       string `json:"id"`
	Action   string `json:"action"`
	Entity   string `json:"entity"`
	EntityID string `json:"entityId"`
	UserName string `json:"userName"`
	Time     string `json:"time"`
}

// GetRecentAudit mengembalikan entri audit inventaris terbaru.
func (r *InventoryRepository) GetRecentAudit(limit int) ([]RecentAuditItem, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	rows, err := r.DB.Query(`
		SELECT
			a.id,
			COALESCE(a.action, '') AS action,
			COALESCE(a.entity, '') AS entity,
			COALESCE(a.entity_id, '') AS entity_id,
			COALESCE(u.name, '') AS user_name,
			CASE
				WHEN a.created_at IS NULL OR a.created_at = 0 THEN ''
				ELSE strftime('%Y-%m-%dT%H:%M:%SZ', a.created_at / 1000, 'unixepoch')
			END AS time
		FROM inventory_audit a
		LEFT JOIN users u ON u.id = a.user_id
		ORDER BY COALESCE(a.created_at, 0) DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []RecentAuditItem{}
	for rows.Next() {
		var item RecentAuditItem
		if err := rows.Scan(
			&item.ID,
			&item.Action,
			&item.Entity,
			&item.EntityID,
			&item.UserName,
			&item.Time,
		); err != nil {
			// Baris rusak tidak boleh lagi dilewatkan tanpa jejak.
			return nil, err
		}
		result = append(result, item)
	}
	// Hasil yang terpotong tidak boleh dianggap lengkap.
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}
