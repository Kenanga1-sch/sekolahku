// ==========================================
// Library Helpers (Drizzle ORM)
// ==========================================

import { db } from "@/db";
import { libraryCatalog, libraryAssets, libraryMembers, libraryLoans, libraryVisits } from "@/db/schema/library";
import { students } from "@/db/schema/students";
import { users } from "@/db/schema/users";
import { eq, like, and, or, desc, asc, gte, lte, lt, sql, inArray } from "drizzle-orm";
import { sanitizeFilter, sanitizeId } from "./security";
import { revalidateLibraryStats } from "./data/library";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import type {
    LibraryCatalog,
    LibraryAsset,
    LibraryMember,
    LibraryLoan,
    LibraryVisit,
    LibraryStats,
} from "@/types/library";

// ==========================================
// Library Catalog & Assets (Binding Logic)
// ==========================================

const streamPipeline = promisify(pipeline);

/**
 * Downloads an image from a URL and saves it to the local covers directory.
 * Returns the local path relative to public/ or null if failed.
 */
async function downloadCoverImage(url: string, isbn: string): Promise<string | null> {
    if (!url || !isbn) return null;

    try {
        const directory = path.join(process.cwd(), "public/uploads/library/covers");
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        const extension = url.split(".").pop()?.split("?")[0] || "jpg";
        const filename = `${isbn}.${extension}`;
        const filePath = path.join(directory, filename);
        const publicPath = `/uploads/library/covers/${filename}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        if (!response.body) throw new Error("Response body is empty");

        // Use any to bypass type issues with web stream vs node stream
        await streamPipeline(response.body as any, fs.createWriteStream(filePath));

        return publicPath;
    } catch (error) {
        console.error("Error downloading cover image:", error);
        return null;
    }
}

/**
 * Get or create a catalog entry by ISBN.
 * If it exists, it updates the record if the new data is more complete (e.g. non-UNSORTED category).
 */
export async function getOrCreateCatalog(data: Partial<LibraryCatalog>): Promise<LibraryCatalog> {
    if (data.isbn) {
        const [existing] = await db.select().from(libraryCatalog).where(eq(libraryCatalog.isbn, data.isbn)).limit(1);
        
        if (existing) {
            // Memory Logic: If user provides a specific category and current is UNSORTED or different, update it.
            if (data.category && data.category !== "UNSORTED" && existing.category !== data.category) {
                const [updated] = await db.update(libraryCatalog)
                    .set({ 
                        category: data.category,
                        updatedAt: new Date() 
                    } as any)
                    .where(eq(libraryCatalog.id, existing.id))
                    .returning();
                return updated as LibraryCatalog;
            }
            return existing as LibraryCatalog;
        }
    }

    const [newCatalog] = await db.insert(libraryCatalog).values({
        title: data.title || "Tanpa Judul",
        author: data.author || "Unknown",
        isbn: data.isbn,
        publisher: data.publisher,
        year: data.year,
        category: data.category || "UNSORTED",
        description: data.description,
        cover: data.cover || "/images/placeholder-book.png", // Use default placeholder if no cover
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any).returning();

    // If there's a remote cover URL, try to download it locally
    if (newCatalog && data.cover && data.cover.startsWith("http") && data.isbn) {
        const localPath = await downloadCoverImage(data.cover, data.isbn);
        if (localPath) {
            const [updated] = await db.update(libraryCatalog)
                .set({ cover: localPath, updatedAt: new Date() } as any)
                .where(eq(libraryCatalog.id, newCatalog.id))
                .returning();
            return updated as LibraryCatalog;
        }
    }

    await revalidateLibraryStats();
    return newCatalog as LibraryCatalog;
}

/**
 * Bind a physical QR code to a catalog entry
 */
export async function bindAsset(qrCode: string, catalogId: string, location?: string): Promise<LibraryAsset> {
    const [asset] = await db.insert(libraryAssets).values({
        id: qrCode,
        catalogId,
        location,
        status: "AVAILABLE",
        condition: "Baik",
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any).returning();

    await revalidateLibraryStats();
    return asset as LibraryAsset;
}

/**
 * Swap a damaged QR code with a new one, preserving history
 */
export async function swapAssetCode(oldQr: string, newQr: string): Promise<LibraryAsset> {
    return db.transaction((tx) => {
        const rows = tx.select().from(libraryAssets).where(eq(libraryAssets.id, oldQr)).limit(1).all();
        const oldAsset = rows[0];
        if (!oldAsset) throw new Error("Asset lama tidak ditemukan");

        // 1. Create new asset with same data
        const [newAsset] = tx.insert(libraryAssets).values({
            ...oldAsset,
            id: newQr,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any).returning().all();

        // 2. Transfer history (Loans)
        tx.update(libraryLoans)
            .set({ itemId: newQr } as any)
            .where(eq(libraryLoans.itemId, oldQr))
            .run();

        // 3. Delete old asset
        tx.delete(libraryAssets).where(eq(libraryAssets.id, oldQr)).run();

        return newAsset as LibraryAsset;
    });
}

/**
 * Lookup book metadata by ISBN
 * Fetches from OpenLibrary API and auto-maps to DDC category
 */
export async function lookupISBN(isbn: string) {
    // 1. Try local database first
    const [local] = await db.select().from(libraryCatalog).where(eq(libraryCatalog.isbn, isbn)).limit(1);
    
    // Import DDC mapping dynamically to avoid circular imports
    const { mapToDDC } = await import("@/lib/library/ddc-mapping");

    if (local) {
        // Count existing physical copies (assets)
        const [countResult] = await db.select({ count: sql<number>`count(*)` })
            .from(libraryAssets)
            .where(eq(libraryAssets.catalogId, local.id));
            
        return {
            title: local.title,
            author: local.author,
            publisher: local.publisher,
            year: local.year,
            cover: local.cover,
            isbn: local.isbn,
            ddcCategory: local.category,
            localFound: true,
            totalExemplars: countResult.count,
            description: local.description,
        };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

        // 2. Try Google Books API (Great for both International and Indonesian books)
        const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, { signal: controller.signal });
        const googleData = await googleRes.json();
        clearTimeout(timeoutId);

        if (googleData.totalItems > 0) {
            const b = googleData.items[0].volumeInfo;
            const subjects = b.categories || [];
            const ddcCategory = mapToDDC(subjects);

            // Zoom Trick & Better Resolution
            let coverUrl = b.imageLinks?.extraLarge || b.imageLinks?.large || b.imageLinks?.medium || b.imageLinks?.thumbnail;
            if (coverUrl && coverUrl.includes("zoom=1")) {
                coverUrl = coverUrl.replace("zoom=1", "zoom=2"); // Try to get higher res
            } else if (coverUrl && !coverUrl.includes("zoom=")) {
                coverUrl += coverUrl.includes("?") ? "&zoom=2" : "?zoom=2";
            }

            return {
                title: b.title,
                author: b.authors?.[0] || "Unknown",
                publisher: b.publisher,
                year: b.publishedDate ? parseInt(b.publishedDate.substring(0, 4)) : undefined,
                cover: coverUrl,
                isbn: isbn,
                subjects,
                ddcCategory,
                localFound: false,
                totalExemplars: 0,
                source: "Google Books",
                description: b.description,
            };
        }

        // 3. Try OpenLibrary API as fallback
        const olController = new AbortController();
        const olTimeoutId = setTimeout(() => olController.abort(), 6000);

        const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, { signal: olController.signal });
        const olData = await olRes.json();
        clearTimeout(olTimeoutId);
        
        const bookKey = `ISBN:${isbn}`;

        if (olData[bookKey]) {
            const b = olData[bookKey];
            const subjects: string[] = [];
            if (b.subjects) subjects.push(...b.subjects.map((s: any) => s.name || s));
            if (b.subject_places) subjects.push(...b.subject_places.map((s: any) => s.name || s));
            
            const ddcCategory = mapToDDC(subjects);

            return {
                title: b.title,
                author: b.authors?.[0]?.name || "Unknown",
                publisher: b.publishers?.[0]?.name,
                year: b.publish_date ? parseInt(b.publish_date.match(/\d{4}/)?.[0] || "0") : undefined,
                cover: b.cover?.large || b.cover?.medium,
                isbn: isbn,
                subjects,
                ddcCategory,
                localFound: false,
                totalExemplars: 0,
                source: "OpenLibrary",
            };
        }

        return null;
    } catch (e: any) {
        if (e.name === "AbortError") {
            console.warn(`ISBN lookup for ${isbn} timed out`);
        } else {
            console.error("ISBN lookup failed", e);
        }
        return null;
    }
}

// ==========================================
// Library Items (Refactored to Assets)
// ==========================================

export interface GetLibraryAssetsOptions {
    search?: string;
    category?: string;
    status?: string;
}

/**
 * Get all library assets with catalog info
 */
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
        // Flattened properties for UI compatibility
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

/**
 * Get single library asset by QR code
 */
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
        // Flattened properties
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
    return await bindAsset(data.qrCode || `BK-${Date.now()}`, catalog.id, data.location);
};

export const updateLibraryItem = async (id: string, data: any) => {
    const asset = await getAssetByQRCode(id);
    if (!asset) throw new Error("Asset not found");

    const result = await db.transaction(async (tx) => {
        // Update Catalog
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

        // Update Asset
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

// ==========================================
// Library Members
// ==========================================

export interface GetLibraryMembersOptions {
    search?: string;
}

export async function getLibraryMembers(
    page = 1,
    perPage = 20,
    options: GetLibraryMembersOptions = {}
): Promise<{ items: LibraryMember[]; totalPages: number; totalItems: number }> {
    const offset = (page - 1) * perPage;
    const conditions = [eq(libraryMembers.isActive, true)];

    if (options.search) {
        const s = `%${options.search}%`;
        conditions.push(or(like(libraryMembers.name, s), like(libraryMembers.qrCode, s)) as any);
    }

    const whereClause = and(...conditions);

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(libraryMembers).where(whereClause);
    const totalItems = countResult.count;
    const totalPages = Math.ceil(totalItems / perPage);

    const items = await db.select().from(libraryMembers)
        .where(whereClause)
        .limit(perPage)
        .offset(offset)
        .orderBy(desc(libraryMembers.createdAt));

    return { items: items as LibraryMember[], totalPages, totalItems };
}

export async function getMemberByQRCode(qrCode: string): Promise<LibraryMember | null> {
    const [member] = await db.select().from(libraryMembers).where(and(eq(libraryMembers.qrCode, qrCode), eq(libraryMembers.isActive, true))).limit(1);
    return (member as LibraryMember) || null;
}

export async function createLibraryMember(data: Partial<LibraryMember>): Promise<LibraryMember> {
    if (!data.qrCode) {
        data.qrCode = `MBR-${Date.now()}`;
    }
    const [newMember] = await db.insert(libraryMembers).values({
        ...data,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any).returning();
    return newMember as LibraryMember;
}

export async function updateLibraryMember(id: string, data: Partial<LibraryMember>): Promise<LibraryMember> {
    const [updated] = await db.update(libraryMembers)
        .set({
            ...data,
            updatedAt: new Date(),
        } as any)
        .where(eq(libraryMembers.id, id))
        .returning();
    return updated as LibraryMember;
}

export async function deleteLibraryMember(id: string): Promise<boolean> {
    // Soft delete by setting isActive to false
    const [result] = await db.update(libraryMembers)
        .set({ isActive: false, updatedAt: new Date() } as any)
        .where(eq(libraryMembers.id, id))
        .returning();
    return !!result;
}

// ==========================================
// Library Loans
// ==========================================

export async function getActiveLoans(page = 1, perPage = 50) {
    const offset = (page - 1) * perPage;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(libraryLoans).where(eq(libraryLoans.isReturned, false));

    const rows = await db.select({
        loan: libraryLoans,
        member: libraryMembers,
        asset: libraryAssets,
        catalog: libraryCatalog
    })
    .from(libraryLoans)
    .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
    .leftJoin(libraryAssets, eq(libraryLoans.itemId, libraryAssets.id))
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id))
    .where(eq(libraryLoans.isReturned, false))
    .orderBy(asc(libraryLoans.dueDate))
    .limit(perPage)
    .offset(offset);

    return { 
        items: rows.map(r => ({
            ...r.loan,
            member: r.member,
            item: { ...r.asset, catalog: r.catalog }
        })),
        totalItems: countResult.count
    };
}

export async function getOverdueLoans() {
    const now = new Date();
    const rows = await db.select({
        loan: libraryLoans,
        member: libraryMembers,
        asset: libraryAssets,
        catalog: libraryCatalog
    })
    .from(libraryLoans)
    .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
    .leftJoin(libraryAssets, eq(libraryLoans.itemId, libraryAssets.id))
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id))
    .where(and(
        eq(libraryLoans.isReturned, false),
        lt(libraryLoans.dueDate, now)
    ))
    .orderBy(asc(libraryLoans.dueDate));

    return rows.map(r => ({
        ...r.loan,
        member: r.member,
        item: { ...r.asset, catalog: r.catalog }
    }));
}

export async function getInventoryStats() {
    // Get all assets with their catalog info
    const assets = await db.select({
        status: libraryAssets.status,
        category: libraryCatalog.category,
    })
    .from(libraryAssets)
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id));

    // Aggregate by status
    const byStatus: Record<string, number> = {
        AVAILABLE: 0,
        BORROWED: 0,
        DAMAGED: 0,
        LOST: 0,
    };
    
    // Aggregate by category
    const byCategory: Record<string, number> = {};
    
    for (const asset of assets) {
        // Count by status
        if (asset.status && byStatus[asset.status] !== undefined) {
            byStatus[asset.status]++;
        }
        
        // Count by category
        const cat = asset.category || "UNSORTED";
        byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return {
        total: assets.length,
        byStatus,
        byCategory,
    };
}

export async function getMemberActiveLoans(memberId: string) {
    const rows = await db.select({
        loan: libraryLoans,
        asset: libraryAssets,
        catalog: libraryCatalog
    })
    .from(libraryLoans)
    .leftJoin(libraryAssets, eq(libraryLoans.itemId, libraryAssets.id))
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id))
    .where(and(
        eq(libraryLoans.memberId, memberId),
        eq(libraryLoans.isReturned, false)
    ))
    .orderBy(asc(libraryLoans.dueDate));

    return rows.map(r => ({
        ...r.loan,
        item: { ...r.asset, catalog: r.catalog }
    }));
}

export async function borrowBook(memberId: string, assetId: string, loanDays = 7): Promise<LibraryLoan> {
    console.log(`[Library] borrowBook called for member ${memberId}, asset ${assetId}`);
    const now = new Date();
    const dueDate = new Date(now.getTime() + loanDays * 24 * 60 * 60 * 1000);

    return db.transaction((tx) => {
        console.log(`[Library] Inserting loan: member=${memberId}, item=${assetId}, due=${dueDate}`);
        // 1. Create loan
        const [loan] = tx.insert(libraryLoans).values({
            memberId,
            itemId: assetId,
            borrowDate: now,
            dueDate,
            isReturned: false,
            fineAmount: 0,
            finePaid: false,
            createdAt: now,
            updatedAt: now,
        } as any).returning().all();

        // 2. Update asset status
        tx.update(libraryAssets)
            .set({ status: "BORROWED", updatedAt: now } as any)
            .where(eq(libraryAssets.id, assetId))
            .run();

        console.log(`[Library] borrow successful, triggering non-blocking revalidation`);
        revalidateLibraryStats().catch(err => console.error("[Library] Revalidation error:", err));
        return loan as LibraryLoan;
    });
}

export async function returnBook(loanId: string): Promise<LibraryLoan> {
    console.log(`[Library] returnBook called for loan ${loanId}`);
    const rows = db.select().from(libraryLoans).where(eq(libraryLoans.id, loanId)).limit(1).all();
    const loan = rows[0];
    if (!loan) throw new Error("Loan not found");

    const now = new Date();
    let fineAmount = 0;
    if (now > new Date(loan.dueDate)) {
        const diff = Math.ceil((now.getTime() - new Date(loan.dueDate).getTime()) / (24 * 60 * 60 * 1000));
        fineAmount = diff * 1000;
    }

    return db.transaction((tx) => {
        const [updated] = tx.update(libraryLoans)
            .set({ returnDate: now, isReturned: true, fineAmount, updatedAt: now } as any)
            .where(eq(libraryLoans.id, loanId))
            .returning().all();

        tx.update(libraryAssets)
            .set({ status: "AVAILABLE", updatedAt: now } as any)
            .where(eq(libraryAssets.id, loan.itemId))
            .run();

        console.log(`[Library] return successful, triggering non-blocking revalidation`);
        revalidateLibraryStats().catch(err => console.error("[Library] Revalidation error:", err));
        return updated as LibraryLoan;
    });
}

// ==========================================
// Library Visits
// ==========================================

export async function recordVisit(memberId: string): Promise<LibraryVisit> {
    console.log(`[Library] recordVisit called for ${memberId}`);
    const todayStr = new Date().toISOString().split("T")[0];
    const [existing] = await db.select().from(libraryVisits).where(and(eq(libraryVisits.memberId, memberId), eq(libraryVisits.date, todayStr))).limit(1);
    if (existing) {
        console.log(`[Library] existing visit found for today`);
        return existing as LibraryVisit;
    }

    const [visit] = await db.insert(libraryVisits).values({
        memberId,
        date: todayStr,
        timestamp: new Date(),
        createdAt: new Date(),
    } as any).returning();
    
    console.log(`[Library] new visit recorded, calling revalidation`);
    // Non-blocking revalidation
    revalidateLibraryStats().catch(err => console.error("[Library] Revalidation error:", err));
    
    return visit as LibraryVisit;
}

// ==========================================
// ==========================================
// Reports
// ==========================================

export async function getLoanReport(startDate: string, endDate: string) {
    const rows = await db.select({
        loan: libraryLoans,
        member: libraryMembers,
        catalog: libraryCatalog,
        asset: libraryAssets
    })
    .from(libraryLoans)
    .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
    .leftJoin(libraryAssets, eq(libraryLoans.itemId, libraryAssets.id))
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id))
    .where(and(
        gte(libraryLoans.borrowDate, new Date(startDate)),
        lte(libraryLoans.borrowDate, new Date(endDate))
    ))
    .orderBy(desc(libraryLoans.borrowDate));

    return rows.map(r => ({
        id: r.loan.id,
        memberName: r.member?.name || "Unknown",
        memberClass: r.member?.className,
        itemTitle: r.catalog?.title || "No Title",
        borrowDate: r.loan.borrowDate,
        dueDate: r.loan.dueDate,
        returnDate: r.loan.returnDate,
        isReturned: r.loan.isReturned,
        fineAmount: r.loan.fineAmount
    }));
}

export async function getVisitReport(startDate: string, endDate: string) {
    const rows = await db.select({
        visit: libraryVisits,
        member: libraryMembers
    })
    .from(libraryVisits)
    .leftJoin(libraryMembers, eq(libraryVisits.memberId, libraryMembers.id))
    .where(and(
        gte(libraryVisits.date, startDate),
        lte(libraryVisits.date, endDate)
    ))
    .orderBy(desc(libraryVisits.timestamp));

    return rows.map(r => ({
        id: r.visit.id,
        memberName: r.member?.name || r.visit.guestName || "Tamu",
        memberClass: r.member?.className || r.visit.institution || "-",
        date: r.visit.date,
        timestamp: r.visit.timestamp.toISOString()
    }));
}

// ==========================================
// Statistics
// ==========================================

export async function getLibraryStats(): Promise<LibraryStats> {
    const [[cAssets], [cAvail], [cBorr], [cMembers], [cLoans]] = await Promise.all([
        db.select({ count: count() }).from(libraryAssets),
        db.select({ count: count() }).from(libraryAssets).where(eq(libraryAssets.status, "AVAILABLE")),
        db.select({ count: count() }).from(libraryAssets).where(eq(libraryAssets.status, "BORROWED")),
        db.select({ count: count() }).from(libraryMembers).where(eq(libraryMembers.isActive, true)),
        db.select({ count: count() }).from(libraryLoans).where(eq(libraryLoans.isReturned, false)),
    ]);

    return {
        totalBooks: cAssets.count,
        availableBooks: cAvail.count,
        borrowedBooks: cBorr.count,
        totalMembers: cMembers.count,
        activeLoans: cLoans.count,
        overdueLoans: 0, // Simplified for now
        todayVisits: 0,
    };
}

// Helper count function since count() export from drizzle-orm was missing in earlier import?
// Actually Drizzle has 'count' function.
function count() { return sql<number>`count(*)` }

// QR Scanning Logic
export async function smartScan(qrCode: string) {
    console.log(`[smartScan] Starting scan for code: ${qrCode.slice(0, 8)}...`);
    
    // Member first
    console.log(`[smartScan] Checking member...`);
    const member = await getMemberByQRCode(qrCode);
    if (member) {
        console.log(`[smartScan] Found member: ${member.name}`);
        return { type: "member", data: member };
    }

    // Then asset
    console.log(`[smartScan] Checking asset...`);
    const asset = await getAssetByQRCode(qrCode);
    if (asset) {
        console.log(`[smartScan] Found asset: ${asset.id}`);
        return { type: "item", data: asset };
    }

    console.log(`[smartScan] QR code not recognized`);
    return { type: "error", message: "QR code tidak dikenali" };
}

export async function smartScanComplete(qrCode: string) {
    console.log(`[smartScanComplete] Starting for code: ${qrCode.slice(0, 8)}...`);
    
    const scan = await smartScan(qrCode);
    console.log(`[smartScanComplete] smartScan returned type: ${scan.type}`);
    
    if (scan.type === "member") {
        const member = scan.data;
        const todayStr = new Date().toISOString().split("T")[0];

        // Check if first visit today
        console.log(`[smartScanComplete] Checking existing visit...`);
        const [existingVisit] = await db.select().from(libraryVisits)
            .where(and(eq(libraryVisits.memberId, member.id), eq(libraryVisits.date, todayStr)))
            .limit(1);
        console.log(`[smartScanComplete] Existing visit: ${!!existingVisit}`);

        if (!existingVisit) {
            console.log(`[smartScanComplete] Recording new visit...`);
            await recordVisit(member.id);
            console.log(`[smartScanComplete] Visit recorded`);
        }

        console.log(`[smartScanComplete] Fetching active loans...`);
        const activeLoans = await getMemberActiveLoans(member.id);
        console.log(`[smartScanComplete] Found ${activeLoans.length} active loans`);

        console.log(`[smartScanComplete] Returning member result`);
        return {
            ...scan,
            visitStatus: { isFirstVisit: !existingVisit },
            activeLoans
        };
    }

    console.log(`[smartScanComplete] Returning non-member result`);
    return scan;
}

export async function findLoanByItemId(itemId: string) {
    const [row] = await db.select({
        loan: libraryLoans,
        member: libraryMembers
    })
    .from(libraryLoans)
    .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
    .where(and(
        eq(libraryLoans.itemId, itemId),
        eq(libraryLoans.isReturned, false)
    ))
    .limit(1);

    if (!row) return null;
    return {
        ...row.loan,
        member: row.member
    };
}

// ==========================================
// Dashboard & Stats Helpers
// ==========================================

export async function getRecentActivity(limit = 10) {
    const rows = await db.select({
        loan: libraryLoans,
        member: libraryMembers,
        catalog: libraryCatalog,
        asset: libraryAssets
    })
    .from(libraryLoans)
    .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
    .leftJoin(libraryAssets, eq(libraryLoans.itemId, libraryAssets.id))
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id))
    .orderBy(desc(libraryLoans.createdAt))
    .limit(limit);

    return rows.map(r => ({
        id: r.loan.id,
        type: r.loan.isReturned ? "RETURN" : "BORROW",
        date: r.loan.createdAt,
        memberName: r.member?.name || "Unknown",
        bookTitle: r.catalog?.title || "Unknown Book",
    }));
}

export async function getLoanTrend(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rows = await db.select({
        date: sql<string>`DATE(${libraryLoans.borrowDate})`,
        count: sql<number>`count(*)`
    })
    .from(libraryLoans)
    .where(gte(libraryLoans.borrowDate, startDate))
    .groupBy(sql`DATE(${libraryLoans.borrowDate})`)
    .orderBy(asc(sql`DATE(${libraryLoans.borrowDate})`));

    return rows;
}

export async function getCategoryDistribution() {
    const rows = await db.select({
        category: libraryCatalog.category,
        count: sql<number>`count(*)`
    })
    .from(libraryCatalog)
    .groupBy(libraryCatalog.category);

    return rows;
}

export async function getTopBorrowedBooks(limit = 5) {
    const rows = await db.select({
        title: libraryCatalog.title,
        count: sql<number>`count(*)`
    })
    .from(libraryLoans)
    .leftJoin(libraryAssets, eq(libraryLoans.itemId, libraryAssets.id))
    .leftJoin(libraryCatalog, eq(libraryAssets.catalogId, libraryCatalog.id))
    .groupBy(libraryCatalog.title)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

    return rows;
}

export async function getTopActiveMembers(limit = 5) {
    const rows = await db.select({
        name: libraryMembers.name,
        count: sql<number>`count(*)`
    })
    .from(libraryLoans)
    .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
    .groupBy(libraryMembers.name)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

    return rows;
}

export async function hasVisitedToday(memberId: string): Promise<boolean> {
    const todayStr = new Date().toISOString().split("T")[0];
    const [existing] = await db.select().from(libraryVisits)
        .where(and(eq(libraryVisits.memberId, memberId), eq(libraryVisits.date, todayStr)))
        .limit(1);
    return !!existing;
}
