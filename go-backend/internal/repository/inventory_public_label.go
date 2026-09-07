package repository

import (
	"database/sql"
	"encoding/json"
	"time"
)

// PublicLabelResponse adalah bentuk respons endpoint publik untuk halaman
// detail yang dibuka lewat QR pada label cetak.
//
// Field yang TIDAK disertakan dengan sengaja: price, notes, user_id,
// created_at. Endpoint ini tidak terautentikasi, jadi informasi finansial
// dan jejak internal tidak boleh terbawa.
type PublicLabelResponse struct {
	Type          string             `json:"type"`
	ID            string             `json:"id"`
	Name          string             `json:"name"`
	Code          string             `json:"code"`
	Category      string             `json:"category"`
	Unit          string             `json:"unit,omitempty"`
	Location      string             `json:"location"`
	FundingSource string             `json:"fundingSource"`
	FiscalYear    int                `json:"fiscalYear"`
	PhotoUrl      string             `json:"photoUrl,omitempty"`
	Quantity      int                `json:"quantity"`
	UnitNumber    int                `json:"unitNumber,omitempty"`
	Condition     *PublicCondition   `json:"condition,omitempty"`
	ActiveBorrow  *PublicBorrowInfo  `json:"activeBorrow,omitempty"`
	Transfers     []PublicTransfer   `json:"transfers,omitempty"`
	RecentTx      []PublicTxLine     `json:"recentTransactions,omitempty"`
}

type PublicCondition struct {
	Good         int `json:"good"`
	LightDamaged int `json:"lightDamaged"`
	HeavyDamaged int `json:"heavyDamaged"`
	Lost         int `json:"lost"`
}

type PublicBorrowInfo struct {
	RequesterName string `json:"requesterName"`
	Reason        string `json:"reason,omitempty"`
	Since         string `json:"since"`
}

type PublicTransfer struct {
	FromRoom string `json:"fromRoom"`
	ToRoom   string `json:"toRoom"`
	At       string `json:"at"`
}

type PublicTxLine struct {
	Type        string `json:"type"`
	Quantity    int    `json:"quantity"`
	Description string `json:"description,omitempty"`
	At          string `json:"at"`
}

// GetPublicAssetLabel menyusun respons halaman publik untuk satu aset tetap.
func (r *InventoryRepository) GetPublicAssetLabel(id string, unitNumber int) (*PublicLabelResponse, error) {
	var (
		name, category, status            string
		code, roomName, fundingSource     sql.NullString
		photoUrl                          sql.NullString
		fiscalYear                        sql.NullInt64
		quantity                          int
		condGood, condLight, condHeavy, condLost int
	)
	err := r.DB.QueryRow(`
		SELECT a.name, COALESCE(a.category, ''), COALESCE(a.status, ''), a.code,
		       r.name, a.funding_source, a.fiscal_year, a.photo_url,
		       a.quantity, a.condition_good, a.condition_light_damaged,
		       a.condition_heavy_damaged, a.condition_lost
		FROM inventory_assets a
		LEFT JOIN inventory_rooms r ON r.id = a.room_id AND r.deleted_at IS NULL
		WHERE a.id = ? AND a.deleted_at IS NULL
	`, id).Scan(
		&name, &category, &status, &code,
		&roomName, &fundingSource, &fiscalYear, &photoUrl,
		&quantity, &condGood, &condLight, &condHeavy, &condLost,
	)
	if err == sql.ErrNoRows {
		return nil, ErrInventoryNotFound
	}
	if err != nil {
		return nil, err
	}

	// Aset yang diarsipkan (status != ACTIVE) tidak ditampilkan ke publik.
	if status != "ACTIVE" {
		return nil, ErrInventoryNotFound
	}

	resp := &PublicLabelResponse{
		Type:       "asset",
		ID:         id,
		Name:       name,
		Code:       code.String,
		Category:   category,
		Location:   roomName.String,
		Quantity:   quantity,
		UnitNumber: unitNumber,
		Condition: &PublicCondition{
			Good:         condGood,
			LightDamaged: condLight,
			HeavyDamaged: condHeavy,
			Lost:         condLost,
		},
	}
	if fundingSource.Valid {
		resp.FundingSource = fundingSource.String
	}
	if fiscalYear.Valid {
		resp.FiscalYear = int(fiscalYear.Int64)
	}
	if photoUrl.Valid {
		resp.PhotoUrl = photoUrl.String
	}

	// Peminjaman aktif: aset yang sedang dipinjam dan belum dikembalikan.
	var (
		reqName, reason sql.NullString
		since           sql.NullInt64
	)
	err = r.DB.QueryRow(`
		SELECT u.name, br.reason, br.approved_at
		FROM inventory_borrow_requests br
		LEFT JOIN users u ON u.id = br.requester_id
		WHERE br.asset_id = ? AND br.status = 'approved'
		ORDER BY br.approved_at DESC LIMIT 1
	`, id).Scan(&reqName, &reason, &since)
	if err == nil {
		resp.ActiveBorrow = &PublicBorrowInfo{
			RequesterName: reqName.String,
			Reason:        reason.String,
			Since:         formatMillisISO(since),
		}
	}

	// Riwayat pindah ruangan: ambil dari audit log yang mengubah room_id.
	transfers, err := r.getAssetRoomTransfers(id)
	if err == nil {
		resp.Transfers = transfers
	}

	return resp, nil
}

// GetPublicItemLabel menyusun respons halaman publik untuk satu barang
// habis pakai.
func (r *InventoryRepository) GetPublicItemLabel(id string, unitNumber int) (*PublicLabelResponse, error) {
	var (
		name, category, unit              string
		code, location, fundingSource     sql.NullString
		photoUrl                          sql.NullString
		fiscalYear                        sql.NullInt64
		currentStock                      int
	)
	err := r.DB.QueryRow(`
		SELECT i.name, COALESCE(i.category, ''), COALESCE(i.unit, ''), i.code,
		       i.location, i.funding_source, i.fiscal_year, i.photo_url, i.current_stock
		FROM inventory_items i
		WHERE i.id = ? AND i.deleted_at IS NULL
	`, id).Scan(
		&name, &category, &unit, &code,
		&location, &fundingSource, &fiscalYear, &photoUrl, &currentStock,
	)
	if err == sql.ErrNoRows {
		return nil, ErrInventoryNotFound
	}
	if err != nil {
		return nil, err
	}

	resp := &PublicLabelResponse{
		Type:       "item",
		ID:         id,
		Name:       name,
		Code:       code.String,
		Category:   category,
		Unit:       unit,
		Location:   location.String,
		Quantity:   currentStock,
		UnitNumber: unitNumber,
	}
	if fundingSource.Valid {
		resp.FundingSource = fundingSource.String
	}
	if fiscalYear.Valid {
		resp.FiscalYear = int(fiscalYear.Int64)
	}
	if photoUrl.Valid {
		resp.PhotoUrl = photoUrl.String
	}

	// Transaksi terakhir untuk barang habis pakai (mutasi masuk/keluar).
	txRows, err := r.DB.Query(`
		SELECT type, quantity, COALESCE(description, ''),
		       CASE
		           WHEN date IS NULL OR date = 0 THEN ''
		           ELSE strftime('%Y-%m-%dT%H:%M:%SZ', date / 1000, 'unixepoch')
		       END AS at
		FROM inventory_transactions
		WHERE item_id = ? AND deleted_at IS NULL
		ORDER BY date DESC LIMIT 5
	`, id)
	if err == nil {
		defer txRows.Close()
		for txRows.Next() {
			var line PublicTxLine
			if err := txRows.Scan(&line.Type, &line.Quantity, &line.Description, &line.At); err != nil {
				continue
			}
			resp.RecentTx = append(resp.RecentTx, line)
		}
	}

	return resp, nil
}

// getAssetRoomTransfers membaca riwayat pemindahan ruangan dari inventory_audit.
// Perubahan room_id tercatat di kolom changes sebagai JSON array.
func (r *InventoryRepository) getAssetRoomTransfers(assetID string) ([]PublicTransfer, error) {
	rows, err := r.DB.Query(`
		SELECT changes, created_at
		FROM inventory_audit
		WHERE entity = 'ASSET' AND entity_id = ? AND action = 'UPDATE'
		ORDER BY created_at DESC LIMIT 10
	`, assetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []PublicTransfer{}
	for rows.Next() {
		var changesText sql.NullString
		var createdAt sql.NullInt64
		if err := rows.Scan(&changesText, &createdAt); err != nil {
			continue
		}
		if !changesText.Valid || changesText.String == "" {
			continue
		}
		var changes []struct {
			Field    string      `json:"field"`
			OldValue interface{} `json:"oldValue"`
			NewValue interface{} `json:"newValue"`
		}
		if err := json.Unmarshal([]byte(changesText.String), &changes); err != nil {
			continue
		}
		for _, ch := range changes {
			if ch.Field != "room" && ch.Field != "room_id" && ch.Field != "roomId" {
				continue
			}
			from, _ := ch.OldValue.(string)
			to, _ := ch.NewValue.(string)
			out = append(out, PublicTransfer{
				FromRoom: r.resolveRoomName(from),
				ToRoom:   r.resolveRoomName(to),
				At:       formatMillisISO(createdAt),
			})
		}
	}
	return out, rows.Err()
}

func (r *InventoryRepository) resolveRoomName(id string) string {
	if id == "" {
		return "-"
	}
	var name string
	if err := r.DB.QueryRow("SELECT name FROM inventory_rooms WHERE id = ?", id).Scan(&name); err != nil {
		return "-"
	}
	return name
}

func formatMillisISO(mi sql.NullInt64) string {
	if !mi.Valid || mi.Int64 == 0 {
		return ""
	}
	return time.UnixMilli(mi.Int64).UTC().Format("2006-01-02T15:04:05Z")
}
