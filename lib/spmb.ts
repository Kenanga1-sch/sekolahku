// ==========================================
// SPMB Helpers (Drizzle ORM)
// ==========================================
import "server-only";

import { db } from "@/db";
import { spmbPeriods, spmbRegistrants } from "@/db/schema/spmb";
import { eq, like, and, or, desc, sql, gte } from "drizzle-orm";
import type { SPMBPeriod, SPMBRegistrant, NewSPMBRegistrant } from "@/db/schema/spmb";



// ==========================================
// Periods
// ==========================================

import { DOCUMENT_LABELS } from "@/types/spmb";

export async function getActivePeriod(): Promise<SPMBPeriod | null> {
    const [period] = await db.select()
        .from(spmbPeriods)
        .where(eq(spmbPeriods.isActive, true))
        .limit(1);
    return period || null;
}

export async function getAllPeriods(): Promise<SPMBPeriod[]> {
    return db.select()
        .from(spmbPeriods)
        .orderBy(desc(spmbPeriods.createdAt));
}

// ==========================================
// Registrants
// ==========================================

export interface GetRegistrantsOptions {
    page?: number;
    perPage?: number;
    status?: string;
    search?: string;
    periodId?: string;
}

export async function getRegistrants(options: GetRegistrantsOptions = {}) {
    const { page = 1, perPage = 20, status, search, periodId } = options;
    const offset = (page - 1) * perPage;
    
    const conditions = [];
    
    if (status && status !== "all") {
        conditions.push(eq(spmbRegistrants.status, status as any));
    }
    
    if (search) {
        const s = `%${search}%`;
        conditions.push(or(
            like(spmbRegistrants.fullName, s),
            like(spmbRegistrants.registrationNumber, s),
            like(spmbRegistrants.studentNik, s)
        ));
    }
    
    if (periodId) {
        conditions.push(eq(spmbRegistrants.periodId, periodId));
    }
    
    const whereClause = conditions.length > 0 
        ? (conditions.length > 1 ? and(...conditions) : conditions[0]) 
        : undefined;
    
    // Count
    let countQuery = db.select({ count: sql<number>`count(*)` })
        .from(spmbRegistrants)
        .$dynamic();
    if (whereClause) countQuery = countQuery.where(whereClause);
    const [{ count: totalItems }] = await countQuery;
    
    // Get items
    let query = db.select()
        .from(spmbRegistrants)
        .$dynamic();
    if (whereClause) query = query.where(whereClause);
    
    const items = await query
        .limit(perPage)
        .offset(offset)
        .orderBy(desc(spmbRegistrants.createdAt));
    
    return {
        items,
        page,
        perPage,
        totalItems,
        totalPages: Math.ceil(totalItems / perPage),
    };
}

export async function getRegistrantByRegistrationNumber(number: string): Promise<SPMBRegistrant | null> {
    const [registrant] = await db.select()
        .from(spmbRegistrants)
        .where(eq(spmbRegistrants.registrationNumber, number))
        .limit(1);
    return registrant || null;
}

export async function getRegistrantByNik(nik: string): Promise<SPMBRegistrant | null> {
    const [registrant] = await db.select()
        .from(spmbRegistrants)
        .where(eq(spmbRegistrants.studentNik, nik))
        .limit(1);
    return registrant || null;
}

export async function getRegistrantById(id: string): Promise<SPMBRegistrant | null> {
    const [registrant] = await db.select()
        .from(spmbRegistrants)
        .where(eq(spmbRegistrants.id, id))
        .limit(1);
    return registrant || null;
}

export async function generateRegistrationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01`);
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(spmbRegistrants)
        .where(gte(spmbRegistrants.createdAt, yearStart));
    
    const sequence = (count + 1).toString().padStart(4, "0");
    return `SPMB-${year}-${sequence}`;
}

export async function createRegistrant(data: NewSPMBRegistrant): Promise<SPMBRegistrant> {
    const [registrant] = await db.insert(spmbRegistrants)
        .values({
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        .returning();
    return registrant;
}

export async function updateRegistrant(id: string, data: Partial<SPMBRegistrant>): Promise<SPMBRegistrant> {
    const [updated] = await db.update(spmbRegistrants)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(spmbRegistrants.id, id))
        .returning();
    return updated;
}

// ==========================================
// Statistics
// ==========================================

export interface SPMBStats {
    total: number;
    pending: number;
    verified: number;
    accepted: number;
    rejected: number;
    inZone: number;
    outZone: number;
}

export async function getSPMBStats(periodId?: string): Promise<SPMBStats> {
    const condition = periodId ? eq(spmbRegistrants.periodId, periodId) : undefined;
    
    const [
        [{ total }],
        [{ pending }],
        [{ verified }],
        [{ accepted }],
        [{ rejected }],
        [{ inZone }],
    ] = await Promise.all([
        db.select({ total: sql<number>`count(*)` }).from(spmbRegistrants).where(condition),
        db.select({ pending: sql<number>`count(*)` }).from(spmbRegistrants).where(and(condition, eq(spmbRegistrants.status, "pending"))),
        db.select({ verified: sql<number>`count(*)` }).from(spmbRegistrants).where(and(condition, eq(spmbRegistrants.status, "verified"))),
        db.select({ accepted: sql<number>`count(*)` }).from(spmbRegistrants).where(and(condition, eq(spmbRegistrants.status, "accepted"))),
        db.select({ rejected: sql<number>`count(*)` }).from(spmbRegistrants).where(and(condition, eq(spmbRegistrants.status, "rejected"))),
        db.select({ inZone: sql<number>`count(*)` }).from(spmbRegistrants).where(and(condition, eq(spmbRegistrants.isInZone, true))),
    ]);
    
    return {
        total,
        pending,
        verified,
        accepted,
        rejected,
        inZone,
        outZone: total - inZone,
    };
}
