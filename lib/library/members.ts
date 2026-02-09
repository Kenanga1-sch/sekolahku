// ==========================================
// Library Members
// ==========================================
import "server-only";

import { db } from "@/db";
import { libraryMembers } from "@/db/schema/library";
import { eq, like, and, or, desc, sql } from "drizzle-orm";
import type { LibraryMember } from "@/types/library";

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
    const [result] = await db.update(libraryMembers)
        .set({ isActive: false, updatedAt: new Date() } as any)
        .where(eq(libraryMembers.id, id))
        .returning();
    return !!result;
}
