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

	var rooms []models.InventoryRoom
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
	return r.GetRoomByID(id)
}

func (r *InventoryRepository) UpdateRoom(id string, req models.CreateInventoryRoomRequest) (*models.InventoryRoom, error) {
	query := `UPDATE inventory_rooms SET name = ?, code = ?, description = ?, location = ?, pic_id = ? WHERE id = ?`
	_, err := r.DB.Exec(query, req.Name, req.Code, req.Description, req.Location, req.PICID, id)
	if err != nil {
		return nil, err
	}
	return r.GetRoomByID(id)
}

func (r *InventoryRepository) DeleteRoom(id string) error {
	_, err := r.DB.Exec("DELETE FROM inventory_rooms WHERE id = ?", id)
	return err
}

// Assets
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

	var assets []models.InventoryAsset
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

		if code.Valid { a.Code = &code.String }
		if rId.Valid { a.RoomID = &rId.String }
		if notes.Valid { a.Notes = &notes.String }
		
		pTime := ToTime(pDate); if pDate.Valid { a.PurchaseDate = &pTime }
		cTime := ToTime(crAt); if crAt.Valid { a.CreatedAt = &cTime }
		uTime := ToTime(upAt); if upAt.Valid { a.UpdatedAt = &uTime }

		if rId.Valid {
			a.Room = &models.InventoryRoom{
				ID:   rId.String,
				Name: rName.String,
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
	return err
}

func (r *InventoryRepository) DeleteAsset(id string) error {
	_, err := r.DB.Exec("DELETE FROM inventory_assets WHERE id = ?", id)
	return err
}

// Items (Consumables)
func (r *InventoryRepository) GetItems(page, limit int, search, category string) ([]models.InventoryItem, int, error) {
	offset := (page - 1) * limit
	query := "SELECT id, name, code, category, unit, min_stock, current_stock, location, price, created_at FROM inventory_items WHERE 1=1"
	var args []interface{}

	if search != "" {
		query += " AND (name LIKE ? OR code LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}
	if category != "" && category != "all" {
		query += " AND category = ?"
		args = append(args, category)
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM (" + query + ")"
	r.DB.QueryRow(countQuery, args...).Scan(&total)

	query += " ORDER BY name ASC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []models.InventoryItem
	for rows.Next() {
		var i models.InventoryItem
		var code, loc sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&i.ID, &i.Name, &code, &i.Category, &i.Unit, &i.MinStock, &i.CurrentStock, &loc, &i.Price, &crAt)
		if err != nil {
			return nil, 0, err
		}
		if code.Valid { i.Code = &code.String }
		if loc.Valid { i.Location = &loc.String }
		cTime := ToTime(crAt)
		i.CreatedAt = &cTime
		items = append(items, i)
	}
	return items, total, nil
}

func (r *InventoryRepository) CreateItem(i models.InventoryItem) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	query := `INSERT INTO inventory_items (id, name, code, category, unit, min_stock, current_stock, location, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.DB.Exec(query, id, i.Name, i.Code, i.Category, i.Unit, i.MinStock, i.CurrentStock, i.Location, i.Price, now, now)
	return err
}

// Transactions
func (r *InventoryRepository) CreateTransaction(t models.InventoryTransaction) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	
	_, err = tx.Exec(`
		INSERT INTO inventory_transactions (id, item_id, type, quantity, date, description, recipient, proof_image, user_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, t.ItemID, t.Type, t.Quantity, now, t.Description, t.Recipient, t.ProofImage, t.UserID, now)
	if err != nil {
		return err
	}

	// Update stock
	if t.Type == "IN" {
		_, err = tx.Exec("UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?", t.Quantity, now, t.ItemID)
	} else {
		_, err = tx.Exec("UPDATE inventory_items SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?", t.Quantity, now, t.ItemID)
	}
	if err != nil {
		return err
	}

	return tx.Commit()
}

// Opname
func (r *InventoryRepository) GetOpnames(page, limit int) ([]models.InventoryOpname, int, error) {
	offset := (page - 1) * limit
	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM inventory_opname").Scan(&total)

	rows, err := r.DB.Query("SELECT id, date, room_id, auditor_id, items, status, note, created_at FROM inventory_opname ORDER BY created_at DESC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var ops []models.InventoryOpname
	for rows.Next() {
		var o models.InventoryOpname
		var rId, aId, note sql.NullString
		var dateMi, crAtMi sql.NullInt64
		err := rows.Scan(&o.ID, &dateMi, &rId, &aId, &o.Items, &o.Status, &note, &crAtMi)
		if err != nil {
			return nil, 0, err
		}
		if rId.Valid { o.RoomID = &rId.String }
		if aId.Valid { o.AuditorID = &aId.String }
		if note.Valid { o.Note = &note.String }
		o.Date = time.UnixMilli(dateMi.Int64)
		cTime := ToTime(crAtMi); o.CreatedAt = &cTime
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
	return err
}

func (r *InventoryRepository) ApplyOpname(id string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var itemsRaw string
	err = tx.QueryRow("SELECT items FROM inventory_opname WHERE id = ?", id).Scan(&itemsRaw)
	if err != nil {
		return err
	}

	var items []map[string]interface{}
	json.Unmarshal([]byte(itemsRaw), &items)

	now := time.Now().UnixMilli()
	for _, it := range items {
		assetId := it["id"].(string)
		good := int(it["condition_good"].(float64))
		light := int(it["condition_light_damaged"].(float64))
		heavy := int(it["condition_heavy_damaged"].(float64))
		lost := int(it["condition_lost"].(float64))
		qty := good + light + heavy + lost

		_, err = tx.Exec(`
			UPDATE inventory_assets 
			SET quantity = ?, condition_good = ?, condition_light_damaged = ?, condition_heavy_damaged = ?, condition_lost = ?, updated_at = ?
			WHERE id = ?
		`, qty, good, light, heavy, lost, now, assetId)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec("UPDATE inventory_opname SET status = 'APPLIED' WHERE id = ?", id)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// Audit
func (r *InventoryRepository) GetAuditLogs(limit int) ([]models.InventoryAudit, error) {
	rows, err := r.DB.Query("SELECT id, action, entity, entity_id, changes, user_id, created_at FROM inventory_audit ORDER BY created_at DESC LIMIT ?", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.InventoryAudit
	for rows.Next() {
		var l models.InventoryAudit
		var changes, uId sql.NullString
		var crAt sql.NullInt64
		rows.Scan(&l.ID, &l.Action, &l.Entity, &l.EntityID, &changes, &uId, &crAt)
		if changes.Valid { l.Changes = &changes.String }
		if uId.Valid { l.UserID = &uId.String }
		cTime := ToTime(crAt); l.CreatedAt = &cTime
		logs = append(logs, l)
	}
	return logs, nil
}
