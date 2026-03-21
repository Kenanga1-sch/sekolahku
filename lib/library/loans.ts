// ==========================================
// Library Loans
// ==========================================
import "server-only";

import { db } from "@/db";
import { libraryCatalog, libraryAssets, libraryMembers, libraryLoans } from "@/db/schema/library";
import { eq, and, desc, asc, lt, sql } from "drizzle-orm";
import { revalidateLibraryStats } from "@/lib/data/library";
import type { LibraryLoan } from "@/types/library";

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
    console.log(`[Library] borrowBook proxying to Go for member ${memberId}, asset ${assetId}`);
    
    const res = await fetch("http://localhost:8080/api/library/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, itemId: assetId, loanDays })
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal meminjam buku via Go API");
    }

    const { data } = await res.json();
    revalidateLibraryStats().catch(err => console.error("[Library] Revalidation error:", err));
    return data as LibraryLoan;
}

export async function returnBook(loanId: string): Promise<LibraryLoan> {
    console.log(`[Library] returnBook proxying to Go for loan ${loanId}`);
    
    const res = await fetch(`http://localhost:8080/api/library/loans/${loanId}/return`, {
        method: "POST"
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal mengembalikan buku via Go API");
    }

    const { data } = await res.json();
    revalidateLibraryStats().catch(err => console.error("[Library] Revalidation error:", err));
    return data as LibraryLoan;
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
