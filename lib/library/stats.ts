// ==========================================
// Library Stats & Reports
// ==========================================
import "server-only";

import { db } from "@/db";
import { libraryCatalog, libraryAssets, libraryMembers, libraryLoans, libraryVisits } from "@/db/schema/library";
import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";
import type { LibraryStats } from "@/types/library";
import { getMemberByQRCode } from "./members";
import { getAssetByQRCode } from "./assets";
import { getMemberActiveLoans } from "./loans";
import { recordVisit } from "./visits";

function count() { return sql<number>`count(*)`; }

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
        overdueLoans: 0,
        todayVisits: 0,
    };
}

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

// ==========================================
// QR Scanning Logic
// ==========================================

export async function smartScan(qrCode: string) {
    console.log(`[smartScan] Starting scan for code: ${qrCode.slice(0, 8)}...`);
    
    console.log(`[smartScan] Checking member...`);
    const member = await getMemberByQRCode(qrCode);
    if (member) {
        console.log(`[smartScan] Found member: ${member.name}`);
        return { type: "member", data: member };
    }

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

        console.log(`[smartScanComplete] Checking existing visit...`);
        const { libraryVisits } = await import("@/db/schema/library");
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
