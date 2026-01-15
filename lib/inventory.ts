// ==========================================
// Inventory PocketBase Helpers
// ==========================================

import { getPocketBase } from "./pocketbase";
import type {
    InventoryAsset,
    InventoryRoom,
    InventoryOpname,
    InventoryAudit,
    InventoryStats,
    AuditAction,
    AuditEntity,
} from "@/types/inventory";

const pb = getPocketBase();

// ==========================================
// Collection Accessors
// ==========================================

export const inventoryCollections = {
    assets: () => pb.collection("inventory_assets"),
    rooms: () => pb.collection("inventory_rooms"),
    opname: () => pb.collection("inventory_opname"),
    audit: () => pb.collection("inventory_audit"),
} as const;

// ==========================================
// Audit Log Helper
// ==========================================

export async function logAudit(
    action: AuditAction,
    entity: AuditEntity,
    entityId: string,
    changes?: any,
    note?: string
) {
    try {
        const user = pb.authStore.model?.id;
        if (!user) return;

        await inventoryCollections.audit().create({
            user,
            action,
            entity,
            entity_id: entityId,
            changes,
            note,
        });
    } catch (error) {
        console.error("Failed to create audit log:", error);
    }
}

// ==========================================
// Inventory Rooms
// ==========================================

export async function getRooms(
    page = 1,
    perPage = 50,
    filter = "",
    sort = "name"
): Promise<{ items: InventoryRoom[]; totalItems: number }> {
    const result = await inventoryCollections.rooms().getList<InventoryRoom>(page, perPage, {
        filter,
        sort,
        expand: "pic",
    });
    return { items: result.items, totalItems: result.totalItems };
}

export async function getAllRooms(): Promise<InventoryRoom[]> {
    return await inventoryCollections.rooms().getFullList<InventoryRoom>({
        sort: "name",
    });
}

export async function createRoom(data: Partial<InventoryRoom>): Promise<InventoryRoom> {
    const room = await inventoryCollections.rooms().create<InventoryRoom>(data);
    await logAudit("CREATE", "ROOM", room.id, data);
    return room;
}

export async function updateRoom(
    id: string,
    data: Partial<InventoryRoom>
): Promise<InventoryRoom> {
    const room = await inventoryCollections.rooms().update<InventoryRoom>(id, data);
    await logAudit("UPDATE", "ROOM", room.id, data);
    return room;
}

export async function deleteRoom(id: string): Promise<boolean> {
    try {
        await inventoryCollections.rooms().delete(id);
        await logAudit("DELETE", "ROOM", id);
        return true;
    } catch {
        return false;
    }
}

// ==========================================
// Inventory Assets
// ==========================================

export async function getAssets(
    page = 1,
    perPage = 20,
    filter = "",
    sort = "-created"
): Promise<{ items: InventoryAsset[]; totalPages: number; totalItems: number }> {
    const result = await inventoryCollections.assets().getList<InventoryAsset>(page, perPage, {
        filter,
        sort,
        expand: "room",
    });
    return {
        items: result.items,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
    };
}

export async function getAsset(id: string): Promise<InventoryAsset | null> {
    try {
        return await inventoryCollections.assets().getOne<InventoryAsset>(id, {
            expand: "room",
        });
    } catch {
        return null;
    }
}

export async function createAsset(data: Partial<InventoryAsset>): Promise<InventoryAsset> {
    const asset = await inventoryCollections.assets().create<InventoryAsset>(data);
    await logAudit("CREATE", "ASSET", asset.id, data);
    return asset;
}

export async function updateAsset(
    id: string,
    data: Partial<InventoryAsset>
): Promise<InventoryAsset> {
    const asset = await inventoryCollections.assets().update<InventoryAsset>(id, data);
    await logAudit("UPDATE", "ASSET", asset.id, data);
    return asset;
}

export async function deleteAsset(id: string): Promise<boolean> {
    try {
        await inventoryCollections.assets().delete(id);
        await logAudit("DELETE", "ASSET", id);
        return true;
    } catch {
        return false;
    }
}

// ==========================================
// Stock Opname
// ==========================================

export async function getOpnameSessions(
    page = 1,
    perPage = 20
): Promise<{ items: InventoryOpname[]; totalItems: number }> {
    const result = await inventoryCollections.opname().getList<InventoryOpname>(page, perPage, {
        sort: "-date",
        expand: "room,auditor",
    });
    return { items: result.items, totalItems: result.totalItems };
}

export async function createOpnameSession(
    data: Partial<InventoryOpname>
): Promise<InventoryOpname> {
    const session = await inventoryCollections.opname().create<InventoryOpname>(data);
    await logAudit("CREATE", "OPNAME", session.id, data);
    return session;
}

/**
 * Apply opname results to assets
 */
export async function applyOpnameSession(id: string): Promise<boolean> {
    try {
        const session = await inventoryCollections.opname().getOne<InventoryOpname>(id);
        if (session.status !== "PENDING") return false;

        // Iterate through items and update asset conditions
        for (const item of session.items) {
            await inventoryCollections.assets().update(item.assetId, {
                condition_good: item.qtyGood,
                condition_light_damaged: item.qtyLightDamage,
                condition_heavy_damaged: item.qtyHeavyDamage,
                condition_lost: item.qtyLost,
                // Update total quantity based on physical count if needed, or keep as is?
                // Usually system quantity should be updated to match physical?
                // For now, let's update quantity to match sum of conditions
                quantity: item.qtyGood + item.qtyLightDamage + item.qtyHeavyDamage,
            });

            await logAudit("OPNAME_APPLY", "ASSET", item.assetId, item);
        }

        // Update session status
        await inventoryCollections.opname().update(id, { status: "APPLIED" });
        await logAudit("OPNAME_APPLY", "OPNAME", id);

        return true;
    } catch (error) {
        console.error("Failed to apply opname:", error);
        return false;
    }
}

// ==========================================
// Statistics
// ==========================================

export async function getInventoryStats(): Promise<InventoryStats> {
    // Use efficient count queries instead of fetching all data
    const [
        totalAssetsResult,
        // For condition breakdowns, we need to fetch a limited set
        // PocketBase doesn't support SUM aggregation natively
        // So we'll use a batched approach with a reasonable limit
    ] = await Promise.all([
        inventoryCollections.assets().getList(1, 1),
    ]);

    const totalAssets = totalAssetsResult.totalItems;

    // For value calculation, we batch in chunks to avoid memory issues
    // This is still not ideal but better than fetching ALL at once
    const BATCH_SIZE = 100;
    const MAX_BATCHES = 10; // Cap at 1000 items for stats

    let stats: InventoryStats = {
        totalAssets,
        totalValue: 0,
        totalItems: 0,
        itemsGood: 0,
        itemsDamaged: 0,
        itemsLost: 0,
    };

    // If we have assets, fetch in batches
    if (totalAssets > 0) {
        const batchCount = Math.min(Math.ceil(totalAssets / BATCH_SIZE), MAX_BATCHES);

        for (let i = 1; i <= batchCount; i++) {
            const batch = await inventoryCollections.assets().getList<InventoryAsset>(i, BATCH_SIZE, {
                fields: 'price,quantity,condition_good,condition_light_damaged,condition_heavy_damaged,condition_lost'
            });

            batch.items.forEach(asset => {
                stats.totalValue += (asset.price || 0) * (asset.quantity || 0);
                stats.totalItems += asset.quantity || 0;
                stats.itemsGood += asset.condition_good || 0;
                stats.itemsDamaged += (asset.condition_light_damaged || 0) + (asset.condition_heavy_damaged || 0);
                stats.itemsLost += asset.condition_lost || 0;
            });
        }
    }

    return stats;
}

