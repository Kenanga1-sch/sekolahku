// ==========================================
// Library Helpers (Drizzle ORM)
// ==========================================

import { db } from "@/db";
import { libraryCatalog, libraryAssets, libraryMembers, libraryLoans, libraryVisits } from "@/db/schema/library";
import { students } from "@/db/schema/students";
import { users } from "@/db/schema/users";
import { eq, like, and, or, desc, asc, gte, lte, lt, sql, inArray } from "drizzle-orm";
import { sanitizeFilter, sanitizeId } from "./security";
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

/**
 * Get or create a catalog entry by ISBN
 */
export async function getOrCreateCatalog(data: Partial<LibraryCatalog>): Promise<LibraryCatalog> {
    if (data.isbn) {
        const [existing] = await db.select().from(libraryCatalog).where(eq(libraryCatalog.isbn, data.isbn)).limit(1);
        if (existing) return existing as LibraryCatalog;
    }

    const [newCatalog] = await db.insert(libraryCatalog).values({
        title: data.title || "Tanpa Judul",
        author: data.author,
        isbn: data.isbn,
        publisher: data.publisher,
        year: data.year,
        category: data.category || "OTHER",
        description: data.description,
        cover: data.cover,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any).returning();

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
 */
export async function lookupISBN(isbn: string) {
    try {
        // Try OpenLibrary API first
        const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
        const data = await response.json();
        const bookKey = `ISBN:${isbn}`;

        if (data[bookKey]) {
            const b = data[bookKey];
            return {
                title: b.title,
                author: b.authors?.[0]?.name,
                publisher: b.publishers?.[0]?.name,
                year: b.publish_date ? parseInt(b.publish_date.match(/\d{4}/)?.[0] || "0") : undefined,
                cover: b.cover?.large || b.cover?.medium,
                isbn: isbn
            };
        }
        return null;
    } catch (e) {
        console.error("ISBN lookup failed", e);
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
        catalog: r.catalog
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
    return { ...row.asset, catalog: row.catalog };
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

    return db.transaction((tx) => {
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
};

export const deleteLibraryItem = async (id: string) => {
    const [loan] = await db.select().from(libraryLoans).where(and(eq(libraryLoans.itemId, id), eq(libraryLoans.isReturned, false))).limit(1);
    if (loan) throw new Error("Buku sedang dipinjam, tidak bisa dihapus");

    const [result] = await db.delete(libraryAssets).where(eq(libraryAssets.id, id)).returning();
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
    const now = new Date();
    const dueDate = new Date(now.getTime() + loanDays * 24 * 60 * 60 * 1000);

    return db.transaction((tx) => {
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

        return loan as LibraryLoan;
    });
}

export async function returnBook(loanId: string): Promise<LibraryLoan> {
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

        return updated as LibraryLoan;
    });
}

// ==========================================
// Library Visits
// ==========================================

export async function recordVisit(memberId: string): Promise<LibraryVisit> {
    const todayStr = new Date().toISOString().split("T")[0];
    const [existing] = await db.select().from(libraryVisits).where(and(eq(libraryVisits.memberId, memberId), eq(libraryVisits.date, todayStr))).limit(1);
    if (existing) return existing as LibraryVisit;

    const [visit] = await db.insert(libraryVisits).values({
        memberId,
        date: todayStr,
        timestamp: new Date(),
        createdAt: new Date(),
    } as any).returning();
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
        memberName: r.member?.name || "Unknown",
        memberClass: r.member?.className,
        date: r.visit.date,
        timestamp: r.visit.timestamp
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
    // Member first
    const member = await getMemberByQRCode(qrCode);
    if (member) return { type: "member", data: member };

    // Then asset
    const asset = await getAssetByQRCode(qrCode);
    if (asset) return { type: "item", data: asset };

    return { type: "error", message: "QR code tidak dikenali" };
}

export async function smartScanComplete(qrCode: string) {
    const scan = await smartScan(qrCode);
    
    if (scan.type === "member") {
        const member = scan.data;
        const todayStr = new Date().toISOString().split("T")[0];

        // Check if first visit today
        const [existingVisit] = await db.select().from(libraryVisits)
            .where(and(eq(libraryVisits.memberId, member.id), eq(libraryVisits.date, todayStr)))
            .limit(1);
        
        if (!existingVisit) {
            await recordVisit(member.id);
        }

        const activeLoans = await getMemberActiveLoans(member.id);
        
        return {
            ...scan,
            visitStatus: { isFirstVisit: !existingVisit },
            activeLoans
        };
    }

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
