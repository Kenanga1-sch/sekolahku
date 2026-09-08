package models

import (
	"encoding/json"
	"time"
)

type InventoryRoom struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Code        *string    `json:"code"`
	Description *string    `json:"description"`
	Location    *string    `json:"location"`
	PICID       *string    `json:"picId"`
	PIC         *User      `json:"pic,omitempty"`
	CreatedAt   *time.Time `json:"createdAt"`
}

type CreateInventoryRoomRequest struct {
	Name        string  `json:"name"`
	Code        *string `json:"code,omitempty"`
	Description *string `json:"description,omitempty"`
	Location    *string `json:"location,omitempty"`
	PICID       *string `json:"picId,omitempty"`
}

type InventoryAsset struct {
	ID                    string                `json:"id"`
	Name                  string                `json:"name"`
	Code                  *string               `json:"code"`
	Category              string                `json:"category"`
	Price                 int                   `json:"price"`
	Quantity              int                   `json:"quantity"`
	RoomID                *string               `json:"room"` // Match frontend expectation 'room'
	Expand                *InventoryAssetExpand `json:"expand,omitempty"`
	ConditionGood         int                   `json:"condition_good"`
	ConditionLightDamaged int                   `json:"condition_light_damaged"`
	ConditionHeavyDamaged int                   `json:"condition_heavy_damaged"`
	ConditionLost         int                   `json:"condition_lost"`
	PurchaseDate          *time.Time            `json:"purchase_date"`
	Notes                 *string               `json:"notes"`
	Status                string                `json:"status"`
	FundingSource         *string               `json:"fundingSource"`
	FiscalYear            *int                  `json:"fiscalYear"`
	PhotoUrl              *string               `json:"photoUrl"`
	CreatedAt             *time.Time            `json:"created_at"`
	UpdatedAt             *time.Time            `json:"updated_at"`
}

type InventoryItem struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Code         *string    `json:"code"`
	Category     string     `json:"category"`
	Unit         string     `json:"unit"`
	MinStock     int        `json:"minStock"`
	CurrentStock int        `json:"currentStock"`
	Location     *string    `json:"location"`
	// RoomID adalah sumber kebenaran scope PIC barang habis pakai (migrasi
	// 000035). Tanpa ini ItemRoomID jatuh ke pencocokan Location dengan nama
	// ruangan, yang sunyi-sunyi gagal begitu nama ruangan diganti dan membuat
	// barang terlindungi berubah jadi "stok umum" yang boleh diubah siapa saja.
	RoomID   *string `json:"room"` // Match frontend expectation 'room'
	Price    int     `json:"price"`
	FundingSource *string   `json:"fundingSource"`
	FiscalYear    *int      `json:"fiscalYear"`
	PhotoUrl      *string   `json:"photoUrl"`
	CreatedAt    *time.Time `json:"createdAt"`
	UpdatedAt    *time.Time `json:"updatedAt"`
}

type InventoryAssetExpand struct {
	Room *InventoryRoom `json:"room,omitempty"`
}

type InventoryTransaction struct {
	ID       string         `json:"id"`
	ItemID   string         `json:"itemId"`
	Item     *InventoryItem `json:"item,omitempty"`
	Type     string         `json:"type"` // IN, OUT
	Quantity int            `json:"quantity"`
	// UnitNumbers berisi nomor-nomor bungkus yang keluar, misalnya [3, 4] untuk
	// "2 rim ke perpustakaan". Bila kosong, nomor terkecil yang masih tersedia
	// dipakai otomatis agar stok tetap konsisten.
	UnitNumbers []int       `json:"unitNumbers,omitempty"`
	Date        *time.Time  `json:"date"`
	Description *string     `json:"description"`
	Recipient   *string     `json:"recipient"`
	ProofImage  *string     `json:"proofImage"`
	UserID      *string     `json:"userId"`
	CreatedAt   *time.Time  `json:"createdAt"`
}

type InventoryOpname struct {
	ID        string                `json:"id"`
	Date      time.Time             `json:"date"`
	RoomID    *string               `json:"room"`
	AuditorID *string               `json:"auditor"`
	Items     []InventoryOpnameItem `json:"items"`
	Status    string                `json:"status"` // PENDING, APPLIED
	Note      *string               `json:"note"`
	CreatedAt *time.Time            `json:"createdAt"`
}

// InventoryOpnameItem adalah satu baris hasil hitung fisik.
//
// Kolom system_* diisi pada saat opname dibuat (angka menurut sistem), dan
// counted_* diisi hasil hitung di lapangan. Selisihnya (counted - system)
// tersimpan permanen, sehingga setelah opname diterapkan masih bisa
// dilacak berapa selisihnya. Sebelumnya info ini tidak disimpan sama sekali.
type InventoryOpnameItem struct {
	ID                  string `json:"id,omitempty"`
	AssetID             string `json:"assetId"`
	SystemQuantity      int    `json:"systemQty"`
	SystemGood          int    `json:"systemGood"`
	SystemLightDamaged  int    `json:"systemLightDamaged"`
	SystemHeavyDamaged  int    `json:"systemHeavyDamaged"`
	SystemLost          int    `json:"systemLost"`
	CountedGood         int    `json:"qtyGood"`
	CountedLightDamaged int    `json:"qtyLightDamage"`
	CountedHeavyDamaged int    `json:"qtyHeavyDamage"`
	CountedLost         int    `json:"qtyLost"`
	Note                string `json:"note,omitempty"`
}

type InventoryAudit struct {
	ID        string          `json:"id"`
	Action    string          `json:"action"`
	Entity    string          `json:"entity"`
	EntityID  string          `json:"entity_id"`
	Changes   json.RawMessage `json:"changes,omitempty"`
	UserID    *string         `json:"user_id"`
	CreatedAt *time.Time      `json:"created_at"`
}

// ItemUnitStatus adalah keadaan satu bungkus/unit barang habis pakai.
type ItemUnitStatus string

const (
	// UnitUnitAvailable berarti unit masih tersedia di gudang.
	ItemUnitAvailable ItemUnitStatus = "AVAILABLE"
	// ItemUnitIssued berarti unit sudah keluar; IssuedTo mencatat ke mana.
	ItemUnitIssued ItemUnitStatus = "ISSUED"
)

// ItemBatch adalah satu kali penerimaan barang habis pakai. Setiap penerimaan
// membentuk batch dengan rentang nomor sendiri.
//
// Penomoran berlanjut antar batch dalam satu tahun, lalu mulai dari 1 lagi saat
// tahun berganti. Karena nomor berulang tiap tahun, label wajib mencantumkan
// tahun — itulah sebabnya Year disimpan di sini.
type ItemBatch struct {
	ID            string  `json:"id"`
	ItemID        string  `json:"itemId"`
	BatchCode     string  `json:"batchCode,omitempty"`
	Year          int     `json:"year"`
	StartNo       int     `json:"startNo"`
	EndNo         int     `json:"endNo"`
	Quantity      int     `json:"quantity"`
	FundingSource *string `json:"fundingSource,omitempty"`
	FiscalYear    *int    `json:"fiscalYear,omitempty"`
	ReceivedAt    *int64  `json:"receivedAt,omitempty"`
	Description   *string `json:"description,omitempty"`
	TransactionID *string `json:"transactionId,omitempty"`
	CreatedAt     *int64  `json:"createdAt,omitempty"`
	UpdatedAt     *int64  `json:"updatedAt,omitempty"`
}

// ItemUnit adalah satu bungkus/unit fisik barang habis pakai.
//
// Inisial ini yang memungkinkan pertanyaan "nomor berapa yang keluar ke mana"
// dijawab: tiap nomor punya baris sendiri berikut status dan tujuannya.
type ItemUnit struct {
	ID            string         `json:"id"`
	ItemID        string         `json:"itemId"`
	BatchID       *string        `json:"batchId,omitempty"`
	UnitNo        int            `json:"unitNo"`
	Year          int            `json:"year"`
	Status        ItemUnitStatus `json:"status"`
	IssuedTo      *string        `json:"issuedTo,omitempty"`
	IssuedAt      *int64         `json:"issuedAt,omitempty"`
	TransactionID *string        `json:"transactionId,omitempty"`
	CreatedAt     *int64         `json:"createdAt,omitempty"`
	UpdatedAt     *int64         `json:"updatedAt,omitempty"`
}

type InventoryStats struct {
	TotalAssets  int     `json:"totalAssets"`
	TotalValue   float64 `json:"totalValue"`
	TotalItems   int     `json:"totalItems"`
	ItemsGood    int     `json:"itemsGood"`
	ItemsDamaged int     `json:"itemsDamaged"`
	ItemsLost    int     `json:"itemsLost"`
}
