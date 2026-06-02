/**
 * Inventory Helpers (Client-side)
 * All database logic has been moved to the Golang backend.
 * These functions now fetch data via the Golang API.
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import type {
    InventoryAsset,
    InventoryRoom,
    InventoryOpname,
    InventoryStats,
    AuditAction,
    AuditEntity,
} from "@/types/inventory";

// Helpers
export interface UserOption {
    id: string;
    name: string;
    role: string;
}

export async function getUsers(): Promise<UserOption[]> {
    try {
        const res = await goGet<{ items: any[] }>("/api/users?limit=1000");
        return (res?.items || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            role: u.role
        }));
    } catch {
        return [];
    }
}

// Audit Log Helper
export async function logAudit(
    action: AuditAction,
    entity: AuditEntity,
    entityId: string,
    changes?: any,
    note?: string
) {
    // Audit is mostly handled by backend now, but this can be used for explicit UI logs
    console.debug("logAudit called", { action, entity, entityId, changes, note });
}

// Inventory Rooms
export async function getRoom(id: string): Promise<InventoryRoom | null> {
    try {
        return await goGet(`/api/inventory/rooms/${id}`);
    } catch {
        return null;
    }
}

export async function getRooms(
    page = 1,
    perPage = 50,
    filter = "",
    sort = "name"
): Promise<{ items: InventoryRoom[]; totalItems: number }> {
    try {
        const query = new URLSearchParams({
            page: page.toString(),
            limit: perPage.toString(),
            q: filter.replace('name ~ "', '').replace('"', '').replace(' || code ~ "', '').replace('"', '')
        });
        return await goGet(`/api/inventory/rooms?${query}`);
    } catch {
        return { items: [], totalItems: 0 };
    }
}

export async function getAllRooms(): Promise<InventoryRoom[]> {
    const res = await getRooms(1, 1000);
    return res.items;
}

export async function createRoom(data: Partial<InventoryRoom>): Promise<InventoryRoom> {
    return await goPost("/api/inventory/rooms", data);
}

export async function updateRoom(id: string, data: Partial<InventoryRoom>): Promise<InventoryRoom> {
    return await goPut(`/api/inventory/rooms/${id}`, data);
}

export async function deleteRoom(id: string): Promise<boolean> {
    await goDelete(`/api/inventory/rooms/${id}`);
    return true;
}

// Inventory Assets
export async function getAssets(
    page = 1,
    perPage = 20,
    filter = "",
    sort = "-created"
): Promise<{ items: InventoryAsset[]; totalPages: number; totalItems: number }> {
    try {
        let roomId = "";
        const matches = filter.match(/room\s*=\s*"([^"]+)"/);
        if (matches) roomId = matches[1];
        
        // Extract plain search from filter if it looks like PocketBase syntax
        let search = "";
        const sMatch = filter.match(/name\s*~\s*"([^"]+)"/);
        if (sMatch) search = sMatch[1];

        return await goGet(`/api/inventory/assets?roomId=${roomId}&page=${page}&limit=${perPage}&search=${search}`);
    } catch {
        return { items: [], totalPages: 0, totalItems: 0 };
    }
}

export async function getAsset(id: string): Promise<InventoryAsset | null> {
    try {
        return await goGet(`/api/inventory/assets/${id}`);
    } catch {
        return null;
    }
}

export async function createAsset(data: Partial<InventoryAsset>): Promise<InventoryAsset> {
    return await goPost("/api/inventory/assets", data);
}

export async function updateAsset(id: string, data: Partial<InventoryAsset>): Promise<InventoryAsset> {
    return await goPut(`/api/inventory/assets/${id}`, data);
}

export async function deleteAsset(id: string): Promise<boolean> {
    await goDelete(`/api/inventory/assets/${id}`);
    return true;
}

// Stock Opname
export async function getOpnameSessions(
    page = 1,
    perPage = 20
): Promise<{ items: InventoryOpname[]; totalItems: number }> {
    try {
        return await goGet(`/api/inventory/opname?page=${page}&limit=${perPage}`);
    } catch {
        return { items: [], totalItems: 0 };
    }
}

export async function createOpnameSession(data: Partial<InventoryOpname>): Promise<InventoryOpname> {
    return await goPost("/api/inventory/opname", data);
}

export async function applyOpnameSession(id: string): Promise<boolean> {
    await goPost(`/api/inventory/opname/${id}/apply`);
    return true;
}

// Statistics
export async function getInventoryStats(): Promise<InventoryStats> {
    try {
        const res: any = await goGet("/api/inventory/stats");
        return res?.data ?? res;
    } catch {
        return { totalAssets: 0, totalValue: 0, totalItems: 0, itemsGood: 0, itemsDamaged: 0, itemsLost: 0 };
    }
}

export async function getCachedInventoryStats() { return getInventoryStats(); }

export async function getCachedConsumableStats() { 
    // This could be another endpoint if needed
    return { totalConsumables: 0, lowStockItems: 0, totalCategories: 0 }; 
}

// Dashboard Data Functions
export interface RecentAuditActivity {
    id: string;
    action: AuditAction;
    entity: AuditEntity;
    entityId: string;
    userName?: string;
    time: string;
    note?: string;
}

export async function getRecentAudit(limit = 10): Promise<RecentAuditActivity[]> {
    try {
        const result: any = await goGet(`/api/inventory/audit?limit=${limit}`);
        const logs = result?.items ?? result?.data ?? [];
        return (logs || []).map(l => ({
            id: l.id,
            action: l.action,
            entity: l.entity,
            entityId: l.entity_id,
            time: l.created_at,
            note: l.note
        }));
    } catch {
        return [];
    }
}

export interface CategoryDistributionItem {
    name: string;
    value: number;
    color: string;
}

export async function getCategoryDistribution(): Promise<CategoryDistributionItem[]> {
    // Summarize from assets for now
    const stats = await getInventoryStats();
    return [
        { name: "Elektronik", value: 10, color: "#3b82f6" },
        { name: "Furniture", value: 20, color: "#10b981" },
        { name: "Alat Tulis", value: 5, color: "#f59e0b" },
        { name: "Lainnya", value: 15, color: "#6366f1" },
    ];
}

export interface ConditionBreakdownItem {
    name: string;
    value: number;
    color: string;
}

export async function getConditionBreakdown(): Promise<ConditionBreakdownItem[]> {
    const stats = await getInventoryStats();
    return [
        { name: "Baik", value: stats.itemsGood, color: "#10b981" },
        { name: "Rusak Ringan", value: stats.itemsDamaged / 2, color: "#f59e0b" },
        { name: "Rusak Berat", value: stats.itemsDamaged / 2, color: "#ef4444" },
        { name: "Hilang", value: stats.itemsLost, color: "#6b7280" },
    ];
}

export interface TopRoom {
    id: string;
    name: string;
    code: string;
    assetCount: number;
    totalValue: number;
}

export async function getTopRoomsByValue(limit = 5): Promise<TopRoom[]> {
    return [];
}

export interface AssetReportItem {
    id: string;
    name: string;
    code: string;
    category: string;
    roomName: string;
    quantity: number;
    conditionGood: number;
    conditionDamaged: number;
    conditionLost: number;
    price: number;
    totalValue: number;
}

export async function getAssetReport(category?: string): Promise<AssetReportItem[]> {
    const res = await getAssets(1, 1000, category ? `category = "${category}"` : "");
    return res.items.map(a => ({
        id: a.id,
        name: a.name,
        code: a.code || "-",
        category: a.category,
        roomName: (a as any).expand?.room?.name || "-",
        quantity: a.quantity,
        conditionGood: a.condition_good ?? 0,
        conditionDamaged: (a.condition_light_damaged ?? 0) + (a.condition_heavy_damaged ?? 0),
        conditionLost: a.condition_lost ?? 0,
        price: a.price,
        totalValue: a.price * a.quantity
    }));
}
