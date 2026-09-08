package repository

import (
	"database/sql"
	"strings"
)

// ==========================================
// Otorisasi berbasis ruangan (PIC scope)
// ==========================================
// Desain: tiap ruangan punya penanggung jawab (pic_id di inventory_rooms).
// PIC dapat memegaruhi aset/stok HANYA di ruangannya.
// Admin/superadmin akses penuh.
// Peminjaman aset ruangan lain harus lewat pengajuan yang disetujui admin.

// InventoryScope hasil pemeriksaan akses seorang user.
type InventoryScope struct {
	IsAdmin bool // admin/superadmin — akses penuh
	UserID  string
	RoomIDs []string // ruangan tempat user adalah PIC (kosong bila bukan PIC mana pun)
}

// IsPICOf apakah user PIC ruangan tertentu (admin selalu true).
func (s InventoryScope) IsPICOf(roomID string) bool {
	if s.IsAdmin {
		return true
	}
	for _, id := range s.RoomIDs {
		if id == roomID {
			return true
		}
	}
	return false
}

// ResolveInventoryScope menentukan hak akses user dari context JWT.
func ResolveInventoryScope(db *sql.DB, userID, role string) (InventoryScope, error) {
	scope := InventoryScope{UserID: userID}
	if role == "admin" || role == "superadmin" {
		scope.IsAdmin = true
		return scope, nil
	}

	rows, err := db.Query("SELECT id FROM inventory_rooms WHERE pic_id = ?", strings.TrimSpace(userID))
	if err != nil {
		// tabel belum ada — berarti belum ada ruangan, scope kosong
		if strings.Contains(err.Error(), "no such table") {
			return scope, nil
		}
		return scope, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			scope.RoomIDs = append(scope.RoomIDs, id)
		}
	}
	return scope, nil
}

// AssetRoomID mencari ruangan pemilik sebuah aset.
func AssetRoomID(db *sql.DB, assetID string) (string, error) {
	var roomID sql.NullString
	err := db.QueryRow("SELECT room_id FROM inventory_assets WHERE id = ?", assetID).Scan(&roomID)
	if err != nil {
		return "", err
	}
	return roomID.String, nil
}

// ItemRoomID mencari ruangan pemilik sebuah barang habis pakai.
// Sumber utamanya inventory_items.room_id (migrasi 000035); location yang
// berisi nama ruangan tetap didukung sebagai fallback untuk data lama.
func ItemRoomID(db *sql.DB, itemID string) (string, error) {
	var roomID sql.NullString
	err := db.QueryRow("SELECT room_id FROM inventory_items WHERE id = ? AND deleted_at IS NULL", itemID).Scan(&roomID)
	if err == sql.ErrNoRows {
		return "", ErrInventoryNotFound
	}
	if err != nil {
		return "", err
	}
	// Sumber kebenaran: inventory_items.room_id (ditambah migrasi 000035).
	if roomID.Valid && roomID.String != "" {
		return roomID.String, nil
	}
	// Fallback lama: location berisi nama ruangan. Tetap didukung supaya data
	// yang belum punya room_id tidak tiba-tiba jadi tak terlindungi.
	var legacy sql.NullString
	err = db.QueryRow("SELECT location FROM inventory_items WHERE id = ?", itemID).Scan(&legacy)
	if err != nil || !legacy.Valid || legacy.String == "" {
		return "", nil
	}
	var byName sql.NullString
	if err := db.QueryRow("SELECT id FROM inventory_rooms WHERE name = ? AND deleted_at IS NULL", legacy.String).Scan(&byName); err != nil {
		return "", nil // lokasi bukan nama ruangan — stok umum, bebas
	}
	return byName.String, nil
}
