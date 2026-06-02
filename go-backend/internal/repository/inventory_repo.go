package repository

import (
	"database/sql"
	"encoding/json"
	"errors"
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
		WHERE status = 'ACTIVE'
	`
	var totalVal sql.NullFloat64
	var tAssets, tQty, tGood, tDamaged, tLost sql.NullInt64

	err := r.DB.QueryRow(query).Scan(&tAssets, &totalVal, &tQty, &tGood, &tDamaged, &tLost)
	if err == nil {
		stats.TotalAssets = int(tAssets.Int64)
		stats.TotalValue = totalVal.Float64
		stats.TotalItems = int(tQty.Int64)
		stats.ItemsGood = int(tGood.Int64)
		stats.ItemsDamaged = int(tDamaged.Int64)
		stats.ItemsLost = int(tLost.Int64)
	}

	return stats, nil
}

// Rooms
func (r *InventoryRepository) GetRooms(q string) ([]models.InventoryRoom, error) {
	query := `
		SELECT r.id, r.name, r.code, r.description, r.location, r.pic_id, r.created_at,
		       u.id, u.name, u.email
		FROM inventory_rooms r
		LEFT JOIN users u ON r.pic_id = u.id
	`
	var args []interface{}
	if q != "" {
		query += " WHERE r.name LIKE ? OR r.code LIKE ?"
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

	return rooms, nil
}

func (r *InventoryRepository) GetRoomByID(id string) (*models.InventoryRoom, error) {
	query := `
		SELECT r.id, r.name, r.code, r.description, r.location, r.pic_id, r.created_at,
		       u.id, u.name, u.email
		FROM inventory_rooms r
		LEFT JOIN users u ON r.pic_id = u.id
		WHERE r.id = ?
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
	query := `UPDATE inventory_rooms SET name = ?, code = ?, description = ?, location = ?, pic_id = ? WHERE id = ?`
	_, err := r.DB.Exec(query, req.Name, req.Code, req.Description, req.Location, req.PICID, id)
	if err != nil {
		return nil, err
	}
	r.logInventoryAudit("UPDATE", "ROOM", id, []map[string]interface{}{
		{"field": "name", "oldValue": nil, "newValue": req.Name},
	}, nil)
	return r.GetRoomByID(id)
}

func (r *InventoryRepository) DeleteRoom(id string) error {
	result, err := r.DB.Exec("DELETE FROM inventory_rooms WHERE id = ?", id)
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
func (r *InventoryRepository) GetAssetByID(id string) (*models.InventoryAsset, error) {
	query := `
		SELECT a.id, a.name, a.code, a.category, a.price, a.quantity, a.room_id,
		       a.condition_good, a.condition_light_damaged, a.condition_heavy_damaged, a.condition_lost,
		       a.purchase_date, a.notes, a.status, a.created_at, a.updated_at,
		       r.id, r.name
		FROM inventory_assets a
		LEFT JOIN inventory_rooms r ON a.room_id = r.id
		WHERE a.id = ?
	`
	var a models.InventoryAsset
	var code, rId, rName, notes sql.NullString
	var pDate, crAt, upAt sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&a.ID, &a.Name, &code, &a.Category, &a.Price, &a.Quantity, &rId,
		&a.ConditionGood, &a.ConditionLightDamaged, &a.ConditionHeavyDamaged, &a.ConditionLost,
		&pDate, &notes, &a.Status, &crAt, &upAt,
		&rId, &rName,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if code.Valid {
		a.Code = &code.String
	}
	if rId.Valid {
		a.RoomID = &rId.String
	}
	if notes.Valid {
		a.Notes = &notes.String
	}

	pTime := ToTime(pDate)
	if pDate.Valid {
		a.PurchaseDate = &pTime
	}
	cTime := ToTime(crAt)
	if crAt.Valid {
		a.CreatedAt = &cTime
	}
	uTime := ToTime(upAt)
	if upAt.Valid {
		a.UpdatedAt = &uTime
	}

	if rId.Valid {
		a.Expand = &models.InventoryAssetExpand{
			Room: &models.InventoryRoom{
				ID:   rId.String,
				Name: rName.String,
			},
		}
	}

	return &a, nil
}
func (r *InventoryRepository) GetAssets(page, limit int, roomId, search, category string) ([]models.InventoryAsset, int, error) {
	offset := (page - 1) * limit
	query := `
		SELECT a.id, a.name, a.code, a.category, a.price, a.quantity, a.room_id,
		       a.condition_good, a.condition_light_damaged, a.condition_heavy_damaged, a.condition_lost,
		       a.purchase_date, a.notes, a.status, a.created_at, a.updated_at,
		       r.id, r.name
		FROM inventory_assets a
		LEFT JOIN inventory_rooms r ON a.room_id = r.id
		WHERE 1=1
	`
	var args []interface{}

	if roomId != "" {
		query += " AND a.room_id = ?"
		args = append(args, roomId)
	}
	if search != "" {
		query += " AND (a.name LIKE ? OR a.code LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}
	if category != "" && category != "all" {
		query += " AND a.category = ?"
		args = append(args, category)
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM (" + query + ")"
	err := r.DB.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query += " ORDER BY a.name ASC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	assets := make([]models.InventoryAsset, 0)
	for rows.Next() {
		var a models.InventoryAsset
		var code, rId, rName, notes sql.NullString
		var pDate, crAt, upAt sql.NullInt64

		err := rows.Scan(
			&a.ID, &a.Name, &code, &a.Category, &a.Price, &a.Quantity, &rId,
			&a.ConditionGood, &a.ConditionLightDamaged, &a.ConditionHeavyDamaged, &a.ConditionLost,
			&pDate, &notes, &a.Status, &crAt, &upAt,
			&rId, &rName,
		)
		if err != nil {
			return nil, 0, err
		}

		if code.Valid {
			a.Code = &code.String
		}
		if rId.Valid {
			a.RoomID = &rId.String
		}
		if notes.Valid {
			a.Notes = &notes.String
		}

		pTime := ToTime(pDate)
		if pDate.Valid {
			a.PurchaseDate = &pTime
		}
		cTime := ToTime(crAt)
		if crAt.Valid {
			a.CreatedAt = &cTime
		}
		uTime := ToTime(upAt)
		if upAt.Valid {
			a.UpdatedAt = &uTime
		}

		if rId.Valid {
			a.Expand = &models.InventoryAssetExpand{
				Room: &models.InventoryRoom{
					ID:   rId.String,
					Name: rName.String,
				},
			}
		}

		assets = append(assets, a)
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
			purchase_date, notes, status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, a.Name, a.Code, a.Category, a.Price, a.Quantity, a.RoomID,
		a.ConditionGood, a.ConditionLightDamaged, a.ConditionHeavyDamaged, a.ConditionLost,
		pDate, a.Notes, "ACTIVE", now, now)

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
			purchase_date = ?, notes = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.DB.Exec(query,
		a.Name, a.Code, a.Category, a.Price, a.Quantity, a.RoomID,
		a.ConditionGood, a.ConditionLightDamaged, a.ConditionHeavyDamaged, a.ConditionLost,
		pDate, a.Notes, now, id)
	if err == nil {
		r.logInventoryAudit("UPDATE", "ASSET", id, []map[string]interface{}{
			{"field": "asset", "oldValue": nil, "newValue": a.Name},
		}, nil)
	}
	return err
}

func (r *InventoryRepository) DeleteAsset(id string) error {
	result, err := r.DB.Exec("DELETE FROM inventory_assets WHERE id = ?", id)
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
	var code, loc sql.NullString
	var crAt, upAt sql.NullInt64
	err := scanner.Scan(
		&i.ID, &i.Name, &code, &i.Category, &i.Unit,
		&i.MinStock, &i.CurrentStock, &loc, &i.Price, &crAt, &upAt,
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
	query := "SELECT id, name, code, category, unit, min_stock, current_stock, location, price, created_at, updated_at FROM inventory_items WHERE 1=1"
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
		"SELECT id, name, code, category, unit, min_stock, current_stock, location, price, created_at, updated_at FROM inventory_items WHERE id = ?",
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
	query := `INSERT INTO inventory_items (id, name, code, category, unit, min_stock, current_stock, location, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.DB.Exec(query, id, i.Name, i.Code, i.Category, i.Unit, i.MinStock, i.CurrentStock, i.Location, i.Price, now, now)
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
		SET name = ?, code = ?, category = ?, unit = ?, min_stock = ?, current_stock = ?, location = ?, price = ?, updated_at = ?
		WHERE id = ?
	`, i.Name, i.Code, i.Category, i.Unit, i.MinStock, i.CurrentStock, i.Location, i.Price, now, id)
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
	result, err := r.DB.Exec("DELETE FROM inventory_items WHERE id = ?", id)
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
		WHERE 1=1
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

// Opname
func (r *InventoryRepository) GetOpnames(page, limit int) ([]models.InventoryOpname, int, error) {
	offset := (page - 1) * limit
	var total int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM inventory_opname").Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.DB.Query("SELECT id, date, room_id, auditor_id, items, status, note, created_at FROM inventory_opname ORDER BY created_at DESC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	ops := make([]models.InventoryOpname, 0)
	for rows.Next() {
		var o models.InventoryOpname
		var rId, aId, note sql.NullString
		var dateMi, crAtMi sql.NullInt64
		err := rows.Scan(&o.ID, &dateMi, &rId, &aId, &o.Items, &o.Status, &note, &crAtMi)
		if err != nil {
			return nil, 0, err
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
		ops = append(ops, o)
	}
	return ops, total, nil
}

func (r *InventoryRepository) CreateOpname(o models.InventoryOpname) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO inventory_opname (id, date, room_id, auditor_id, items, status, note, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, o.Date.UnixMilli(), o.RoomID, o.AuditorID, o.Items, "PENDING", o.Note, now)
	if err != nil {
		return err
	}
	r.logInventoryAudit("CREATE", "OPNAME", id, []map[string]interface{}{
		{"field": "status", "oldValue": nil, "newValue": "PENDING"},
	}, o.AuditorID)
	return nil
}

func (r *InventoryRepository) ApplyOpname(id string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var itemsRaw string
	var status string
	err = tx.QueryRow("SELECT items, status FROM inventory_opname WHERE id = ?", id).Scan(&itemsRaw, &status)
	if err != nil {
		return err
	}
	if status == "APPLIED" {
		return newInventoryBusinessError("Opname sudah pernah diterapkan")
	}

	var items []map[string]interface{}
	if err := json.Unmarshal([]byte(itemsRaw), &items); err != nil {
		return err
	}

	now := time.Now().UnixMilli()
	for _, it := range items {
		assetID := getStringValue(it, "id", "assetId")
		if assetID == "" {
			return newInventoryBusinessError("Data aset opname tidak valid")
		}
		good := getIntValue(it, "condition_good", "qtyGood")
		light := getIntValue(it, "condition_light_damaged", "qtyLightDamage")
		heavy := getIntValue(it, "condition_heavy_damaged", "qtyHeavyDamage")
		lost := getIntValue(it, "condition_lost", "qtyLost")
		if good < 0 || light < 0 || heavy < 0 || lost < 0 {
			return newInventoryBusinessError("Jumlah opname tidak boleh negatif")
		}
		qty := good + light + heavy + lost

		_, err = tx.Exec(`
			UPDATE inventory_assets 
			SET quantity = ?, condition_good = ?, condition_light_damaged = ?, condition_heavy_damaged = ?, condition_lost = ?, updated_at = ?
			WHERE id = ?
		`, qty, good, light, heavy, lost, now, assetID)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec("UPDATE inventory_opname SET status = 'APPLIED' WHERE id = ?", id)
	if err != nil {
		return err
	}
	r.logInventoryAuditTx(tx, "OPNAME_APPLY", "OPNAME", id, []map[string]interface{}{
		{"field": "status", "oldValue": status, "newValue": "APPLIED"},
	}, nil)

	return tx.Commit()
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
func (r *InventoryRepository) logInventoryAudit(action, entity, entityID string, changes interface{}, userID *string) {
	tx, err := r.DB.Begin()
	if err != nil {
		return
	}
	defer tx.Rollback()
	r.logInventoryAuditTx(tx, action, entity, entityID, changes, userID)
	_ = tx.Commit()
}

func (r *InventoryRepository) logInventoryAuditTx(tx *sql.Tx, action, entity, entityID string, changes interface{}, userID *string) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	var changesText *string
	if changes != nil {
		if raw, err := json.Marshal(changes); err == nil {
			text := string(raw)
			changesText = &text
		}
	}
	_, _ = tx.Exec(
		"INSERT INTO inventory_audit (id, action, entity, entity_id, changes, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, action, entity, entityID, changesText, userID, now,
	)
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
