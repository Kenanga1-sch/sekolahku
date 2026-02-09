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
    console.log(`[Library] borrowBook called for member ${memberId}, asset ${assetId}`);
    const now = new Date();
    const dueDate = new Date(now.getTime() + loanDays * 24 * 60 * 60 * 1000);

    return db.transaction((tx) => {
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

        tx.update(libraryAssets)
            .set({ status: "BORROWED", updatedAt: now } as any)
            .where(eq(libraryAssets.id, assetId))
            .run();

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

        revalidateLibraryStats().catch(err => console.error("[Library] Revalidation error:", err));
        return updated as LibraryLoan;
    });
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
