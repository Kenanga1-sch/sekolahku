// ==========================================
// Inventory Helpers (Stubbed - Needs Migration) 
// ==========================================
// These functions are stubs. Full inventory module needs API route migration.
// NOTE: server-only removed because this is used by client components
// TODO: Migrate to API routes like lib/spmb.ts

import type {
    InventoryAsset,
    InventoryRoom,
    InventoryOpname,
    InventoryAudit as InventoryAuditType,
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
        // Fetch users from API (assuming exists, or use direct DB query if server component only)
        // Since inventory.ts is seemingly client/server mixed, let's use fetch to a public API or create one.
        // Checking app/api/users exists.
        const res = await fetch("/api/users?limit=1000"); 
        if (!res.ok) return [];
        const data = await res.json();
        // API returns { items: [], ... }
        return (data.items || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            role: u.role
        }));
    } catch (e) {
        console.error("Failed to fetch users", e);
        return [];
    }
}

// ==========================================
// Audit Log Helper (Stubbed)
// ==========================================

export async function logAudit(
    action: AuditAction,
    entity: AuditEntity,
    entityId: string,
    changes?: any,
    note?: string
) {
    console.warn("logAudit is stubbed - Inventory migration pending");
}

// ==========================================
// Inventory Rooms
// ==========================================

// ==========================================
// Inventory Rooms
// ==========================================

export async function getRoom(id: string): Promise<InventoryRoom | null> {
    try {
        const res = await fetch(`/api/inventory/rooms/${id}`);
        if (!res.ok) return null;
        
        const data = await res.json();
        // Map Drizzle to Type
        return {
            ...data,
            expand: {
                pic: data.pic
            }
        };
    } catch (error) {
        console.error("getRoom error:", error);
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
            q: filter.replace('name ~ "', '').replace('"', '').replace(' || code ~ "', '').replace('"', '') // Simple cleanup
        });
        
        const res = await fetch(`/api/inventory/rooms?${query}`);
        if (!res.ok) throw new Error("Failed to fetch rooms");
        
        const data = await res.json();
        
        // Map Drizzle result to Type
        const items = data.items.map((item: any) => ({
            ...item,
            expand: {
                pic: item.pic
            }
        }));

        return { items, totalItems: data.totalItems };
    } catch (error) {
        console.error("getRooms error:", error);
        return { items: [], totalItems: 0 };
    }
}

export async function getAllRooms(): Promise<InventoryRoom[]> {
    const res = await getRooms(1, 1000);
    return res.items;
}

export async function createRoom(data: Partial<InventoryRoom>): Promise<InventoryRoom> {
    const res = await fetch("/api/inventory/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to create room");
    }
    
    return await res.json();
}

export async function updateRoom(id: string, data: Partial<InventoryRoom>): Promise<InventoryRoom> {
    const res = await fetch(`/api/inventory/rooms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
         const err = await res.text();
         throw new Error(err || "Failed to update room");
    }

    return await res.json();
}

export async function deleteRoom(id: string): Promise<boolean> {
    const res = await fetch(`/api/inventory/rooms/${id}`, {
        method: "DELETE",
    });
    return res.ok;
}

// ==========================================
// Inventory Assets
// ==========================================

// ==========================================
// Inventory Assets
// ==========================================

export async function getAssets(
    page = 1,
    perPage = 20,
    filter = "",
    sort = "-created"
): Promise<{ items: InventoryAsset[]; totalPages: number; totalItems: number }> {
    try {
        // filter string: 'room = "xyz"' -> we extract roomId
        let roomId = "";
        const matches = filter.match(/room\s*=\s*"([^"]+)"/);
        if (matches) {
            roomId = matches[1];
        }
        
        const res = await fetch(`/api/inventory/assets?roomId=${roomId}&page=${page}&limit=${perPage}`);
        if (!res.ok) throw new Error("Failed to fetch assets");
        
        const data = await res.json();
        
        // Map Drizzle to Type (camelCase -> snake_case)
        const items = data.items.map((item: any) => ({
             ...item,
             condition_good: item.conditionGood,
             condition_light_damaged: item.conditionLightDamaged,
             condition_heavy_damaged: item.conditionHeavyDamaged,
             condition_lost: item.conditionLost,
             purchase_date: item.purchaseDate || item.purchase_date,
             room: item.roomId || item.room, // Map backend roomId to frontend room (ID)
             expand: {
                 room: item.room
             }
        }));

        const totalItems = data.totalItems || items.length;
        const totalPages = Math.ceil(totalItems / perPage);

        return { items, totalPages, totalItems };
    } catch (error) {
        console.error("getAssets error:", error);
        return { items: [], totalPages: 0, totalItems: 0 };
    }
}

export async function getAsset(id: string): Promise<InventoryAsset | null> {
    // Not implemented in API yet, usually needed for Edit logic if not passed directly
    return null;
}

export async function createAsset(data: Partial<InventoryAsset>): Promise<InventoryAsset> {
    const res = await fetch("/api/inventory/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Map types if needed. Assuming API expects camelCase and data is camelCase
        body: JSON.stringify({
            ...data,
            roomId: data.room, // Map 'room' (from type) to 'roomId' (API expectation)
            conditionGood: data.condition_good,
            conditionLightDamaged: data.condition_light_damaged,
            conditionHeavyDamaged: data.condition_heavy_damaged,
            conditionLost: data.condition_lost,
            purchaseDate: data.purchase_date,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to create asset");
    }

    return await res.json();
}

export async function updateAsset(id: string, data: Partial<InventoryAsset>): Promise<InventoryAsset> {
    const res = await fetch(`/api/inventory/assets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...data,
            roomId: data.room,
            conditionGood: data.condition_good,
            conditionLightDamaged: data.condition_light_damaged,
            conditionHeavyDamaged: data.condition_heavy_damaged,
            conditionLost: data.condition_lost,
            purchaseDate: data.purchase_date,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to update asset");
    }

    return await res.json();
}

export async function deleteAsset(id: string): Promise<boolean> {
    const res = await fetch(`/api/inventory/assets/${id}`, {
        method: "DELETE",
    });
    return res.ok;
}

// ==========================================
// Stock Opname
// ==========================================

// ==========================================
// Stock Opname
// ==========================================

export async function getOpnameSessions(
    page = 1,
    perPage = 20
): Promise<{ items: InventoryOpname[]; totalItems: number }> {
    try {
        const res = await fetch(`/api/inventory/opname?page=${page}&limit=${perPage}`);
        if (!res.ok) throw new Error("Failed to fetch opname sessions");
        
        const data = await res.json();
        
        // Map Drizzle to Type
        const items = data.items.map((item: any) => ({
             ...item,
             expand: {
                 room: item.room,
                 auditor: item.auditor
             }
        }));

        return { items, totalItems: data.totalItems };
    } catch (error) {
        console.error("getOpnameSessions error:", error);
         return { items: [], totalItems: 0 };
    }
}

export async function createOpnameSession(data: Partial<InventoryOpname>): Promise<InventoryOpname> {
    const res = await fetch("/api/inventory/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        throw new Error("Failed to create opname session");
    }

    return await res.json();
}

export async function applyOpnameSession(id: string): Promise<boolean> {
     const res = await fetch(`/api/inventory/opname/${id}/apply`, {
        method: "POST",
    });
    return res.ok;
}

// ==========================================
// Statistics
// ==========================================

export async function getInventoryStats(): Promise<InventoryStats> {
    return {
        totalAssets: 0,
        totalValue: 0,
        totalItems: 0,
        itemsGood: 0,
        itemsDamaged: 0,
        itemsLost: 0,
    };
}

// ==========================================
// Dashboard Data Functions
// ==========================================

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
    return [];
}

export interface CategoryDistributionItem {
    name: string;
    value: number;
    color: string;
}

export async function getCategoryDistribution(): Promise<CategoryDistributionItem[]> {
    return [];
}

export interface ConditionBreakdownItem {
    name: string;
    value: number;
    color: string;
}

export async function getConditionBreakdown(): Promise<ConditionBreakdownItem[]> {
    return [];
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
    return [];
}
