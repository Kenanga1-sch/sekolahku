// ==========================================
// Inventory Module Types
// ==========================================

import { RecordModel } from "pocketbase";

// Base record
export interface BaseRecord extends RecordModel {
    id: string;
    created: string;
    updated: string;
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
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "OPNAME_APPLY"
    | "LOGIN"
    | "LOGOUT";

export type AuditEntity =
    | "ASSET"
    | "ROOM"
    | "USER"
    | "OPNAME"
    | "SYSTEM";

// ==========================================
// Inventory Rooms
// ==========================================

export interface InventoryRoom extends BaseRecord {
    name: string;
    code: string;
    description?: string;
    pic?: string; // Relation to users
    expand?: {
        pic?: {
            name: string;
            email: string;
        } & BaseRecord;
    };
}

// ==========================================
// Inventory Assets
// ==========================================

export interface InventoryAsset extends BaseRecord {
    name: string;
    code: string;
    category: string;
    purchase_date: string;
    price: number;
    quantity: number; // Total quantity
    room: string; // Relation to inventory_rooms
    image?: string;
    notes?: string;

    // Condition Breakdown
    condition_good: number;
    condition_light_damaged: number;
    condition_heavy_damaged: number;
    condition_lost: number;

    expand?: {
        room?: InventoryRoom;
    };
}

// ==========================================
// Inventory Opname (Stock Take)
// ==========================================

export interface OpnameItem {
    assetId: string;
    assetName: string;
    assetCode: string;
    systemQty: number;

    // Physical Count
    qtyGood: number;
    qtyLightDamage: number;
    qtyHeavyDamage: number;
    qtyLost: number;

    notes?: string;
}

export interface InventoryOpname extends BaseRecord {
    date: string;
    room: string; // Relation to inventory_rooms
    auditor: string; // Relation to users
    items: OpnameItem[];
    status: OpnameStatus;
    note?: string;

    expand?: {
        room?: InventoryRoom;
        auditor?: {
            name: string;
        } & BaseRecord;
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

export interface InventoryAudit extends BaseRecord {
    user: string; // Relation to users
    action: AuditAction;
    entity: AuditEntity;
    entity_id: string;
    changes?: AuditChange[];
    note?: string;

    expand?: {
        user?: {
            name: string;
            email: string;
        } & BaseRecord;
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
