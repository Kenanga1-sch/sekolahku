// ==========================================
// Library Assets (Physical Items)
// ==========================================
import "server-only";

import { db } from "@/db";
import { libraryCatalog, libraryAssets, libraryLoans } from "@/db/schema/library";
import { eq, like, and, or, desc, sql } from "drizzle-orm";
import { revalidateLibraryStats } from "@/lib/data/library";
import { getOrCreateCatalog } from "./catalog";

export interface GetLibraryAssetsOptions {
    search?: string;
    category?: string;
    status?: string;
}

export async function getLibraryAssets(
    page = 1,
    perPage = 20,
    options: GetLibraryAssetsOptions = {}
): Promise<{ items: any[]; totalPages: number; totalItems: number }> {
    const offset = (page - 1) * perPage;
    
    const conditions = [];
    if (options.status) {
        conditions.push(eq(libraryAssets.status, options.status as any));
    }

    if (options.category) {
        conditions.push(eq(libraryCatalog.category, options.category as any));
    }

    if (options.search) {
        const s = `%${options.search}%`;
        conditions.push(or(
            like(libraryCatalog.title, s),
            like(libraryCatalog.author, s),
            like(libraryCatalog.isbn, s),
            like(libraryAssets.id, s)
        ));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(libraryAssets)
        .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id))
        .where(whereClause);
    const totalItems = countResult.count;
    const totalPages = Math.ceil(totalItems / perPage);

    const rows = await db.select({
        asset: libraryAssets,
        catalog: libraryCatalog
    })
    .from(libraryAssets)
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id))
    .where(whereClause)
    .limit(perPage)
    .offset(offset)
    .orderBy(desc(libraryAssets.createdAt));

    const items = rows.map(r => ({
        ...r.asset,
        catalog: r.catalog,
        title: r.catalog?.title,
        author: r.catalog?.author,
        isbn: r.catalog?.isbn,
        publisher: r.catalog?.publisher,
        year: r.catalog?.year,
        category: r.catalog?.category,
        description: r.catalog?.description,
    }));

    return { items, totalPages, totalItems };
}

export async function getAssetByQRCode(qrCode: string): Promise<any | null> {
    const [row] = await db.select({
        asset: libraryAssets,
        catalog: libraryCatalog
    })
    .from(libraryAssets)
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id))
    .where(eq(libraryAssets.id, qrCode))
    .limit(1);

    if (!row) return null;
    return {
        ...row.asset,
        catalog: row.catalog,
        title: row.catalog?.title,
        author: row.catalog?.author,
        isbn: row.catalog?.isbn,
        publisher: row.catalog?.publisher,
        year: row.catalog?.year,
        category: row.catalog?.category,
        description: row.catalog?.description,
    };
}

// Legacy aliases for compatibility
export const getItemByQRCode = getAssetByQRCode;
export const getLibraryItems = getLibraryAssets;

export const createLibraryItem = async (data: any) => {
    const catalog = await getOrCreateCatalog(data);
    const { bindAsset } = await import("./catalog");
    return await bindAsset(data.qrCode || `BK-${Date.now()}`, catalog.id, data.location);
};

export const updateLibraryItem = async (id: string, data: any) => {
    const asset = await getAssetByQRCode(id);
    if (!asset) throw new Error("Asset not found");

    const result = await db.transaction(async (tx) => {
        tx.update(libraryCatalog)
            .set({
                title: data.title,
                author: data.author,
                isbn: data.isbn,
                publisher: data.publisher,
                year: data.year,
                category: data.category,
                description: data.description,
                updatedAt: new Date()
            } as any)
            .where(eq(libraryCatalog.id, asset.catalogId))
            .run();

        const [updatedAsset] = tx.update(libraryAssets)
            .set({
                location: data.location,
                status: data.status,
                updatedAt: new Date()
            } as any)
            .where(eq(libraryAssets.id, id))
            .returning().all();

        return updatedAsset;
    });

    await revalidateLibraryStats();
    return result;
};

export const deleteLibraryItem = async (id: string) => {
    const [loan] = await db.select().from(libraryLoans).where(and(eq(libraryLoans.itemId, id), eq(libraryLoans.isReturned, false))).limit(1);
    if (loan) throw new Error("Buku sedang dipinjam, tidak bisa dihapus");

    const [result] = await db.delete(libraryAssets).where(eq(libraryAssets.id, id)).returning();
    if (result) await revalidateLibraryStats();
    return !!result;
};

export async function getInventoryStats() {
    const assets = await db.select({
        status: libraryAssets.status,
        category: libraryCatalog.category,
    })
    .from(libraryAssets)
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id));

    const byStatus: Record<string, number> = {
        AVAILABLE: 0,
        BORROWED: 0,
        DAMAGED: 0,
        LOST: 0,
    };
    
    const byCategory: Record<string, number> = {};
    
    for (const asset of assets) {
        if (asset.status && byStatus[asset.status] !== undefined) {
            byStatus[asset.status]++;
        }
        
        const cat = asset.category || "UNSORTED";
        byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return {
        total: assets.length,
        byStatus,
        byCategory,
    };
}
