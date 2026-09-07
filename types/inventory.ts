// ==========================================
// Inventory Module Types
//
// Bentuk field harus SAMA dengan JSON yang dikirim backend Go
// (go-backend/internal/models/inventory.go). Sebelumnya tipe ini masih
// mengikuti skema PocketBase lama (`created`/`updated`), sehingga field yang
// sebenarnya bernama `created_at` terbaca undefined dan UI menampilkan
// "Invalid Date".
// ==========================================

// Base record — aset & barang memakai snake_case, ruangan & opname camelCase.
export interface BaseRecord {
    id: string;
}

export interface TimestampedRecord extends BaseRecord {
    created_at?: string | null;
    updated_at?: string | null;
}

export interface CamelStampedRecord extends BaseRecord {
    createdAt?: string | null;
    updatedAt?: string | null;
}

/** Baca stempel waktu dari bentuk mana pun yang dikirim backend. */
export function recordCreatedAt(r: BaseRecord & Partial<TimestampedRecord & CamelStampedRecord>): string | null {
    return r.created_at ?? r.createdAt ?? null;
}

// ==========================================
// Inventory Enums
// ==========================================

export type AssetCondition =
    | "BAIK"
    | "RUSAK RINGAN"
    | "RUSAK BERAT"
    | "HILANG";

export type OpnameStatus = "PENDING" | "APPLIED" | "REJECTED";

export type AuditAction =
    | "create"
    | "update"
    | "delete"
    | "status_change"
    | "login"
    | "logout"
    | "export"
    | "view"
    | "bulk_action"
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "OPNAME_APPLY"
    | "LOGIN"
    | "LOGOUT";

export type AuditEntity =
    | "registrant"
    | "user"
    | "announcement"
    | "period"
    | "settings"
    | "document"
    | "ASSET"
    | "ITEM"
    | "ROOM"
    | "USER"
    | "OPNAME"
    | "SYSTEM";

// ==========================================
// Inventory Rooms
// ==========================================

export interface InventoryRoom extends CamelStampedRecord {
    name: string;
    code?: string | null;
    description?: string | null;
    location?: string | null;
    picId?: string | null;
    pic?: { id: string; name: string; email?: string } | null;
}

// ==========================================
// Inventory Assets
// ==========================================

export interface InventoryAsset extends TimestampedRecord {
    name: string;
    code?: string | null;
    category: string;
    price: number;
    quantity: number;
    room?: string | null;
    condition_good: number;
    condition_light_damaged: number;
    condition_heavy_damaged: number;
    condition_lost: number;
    purchase_date?: string | null;
    notes?: string | null;
    status: string;
    expand?: {
        room?: { id: string; name: string };
    };
}

// ==========================================
// Inventory Opname (Stock Take)
// ==========================================

export interface OpnameItem {
    assetId: string;
    assetName: string;
    assetCode?: string | null;
    systemQty: number;

    // Physical Count
    qtyGood: number;
    qtyLightDamage: number;
    qtyHeavyDamage: number;
    qtyLost: number;

    notes?: string;
}

export interface InventoryOpname extends CamelStampedRecord {
    date: string;
    room?: string | null;
    auditor?: string | null;
    items: OpnameItem[];
    status: OpnameStatus;
    note?: string | null;
    expand?: {
        room?: { id: string; name: string };
        auditor?: { id: string; name: string };
    };
}

// ==========================================
// Inventory Audit Log
// ==========================================

export interface AuditChange {
    field: string;
    oldValue: string | number | boolean | null;
    newValue: string | number | boolean | null;
}

export interface InventoryAudit extends TimestampedRecord {
    user_id?: string | null;
    action: AuditAction;
    entity: AuditEntity;
    entity_id: string;
    changes?: AuditChange[];
    note?: string | null;
    expand?: {
        user?: { id: string; name: string; email?: string };
    };
}

// ==========================================
// Stats Types
// ==========================================

export interface InventoryStats {
    totalAssets: number;
    totalValue: number;
    totalItems: number; // Sum of quantities
    itemsGood: number;
    itemsDamaged: number; // Light + Heavy
    itemsLost: number;
}
