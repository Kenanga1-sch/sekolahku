// ==========================================
// Library Visits
// ==========================================
import "server-only";

import { db } from "@/db";
import { libraryVisits, libraryMembers } from "@/db/schema/library";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { revalidateLibraryStats } from "@/lib/data/library";
import type { LibraryVisit } from "@/types/library";

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
    revalidateLibraryStats().catch(err => console.error("[Library] Revalidation error:", err));
    
    return visit as LibraryVisit;
}

export async function hasVisitedToday(memberId: string): Promise<boolean> {
    const todayStr = new Date().toISOString().split("T")[0];
    const [existing] = await db.select().from(libraryVisits)
        .where(and(eq(libraryVisits.memberId, memberId), eq(libraryVisits.date, todayStr)))
        .limit(1);
    return !!existing;
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
