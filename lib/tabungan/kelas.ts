// ==========================================
// Tabungan Kelas CRUD Operations
// ==========================================
import "server-only";

import { db } from "@/db";
import { tabunganKelas } from "@/db/schema/tabungan";
import { users } from "@/db/schema/users";
import { eq, asc, sql } from "drizzle-orm";
import type {
    TabunganKelasWithRelations,
    TabunganKelasFormData,
} from "@/types/tabungan";

export async function getKelas(page = 1, perPage = 20): Promise<{ items: TabunganKelasWithRelations[]; totalPages: number; totalItems: number }> {
    const offset = (page - 1) * perPage;

    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tabunganKelas);
    
    const totalItems = countResult.count;
    const totalPages = Math.ceil(totalItems / perPage);

    const rows = await db
        .select({
            kelas: tabunganKelas,
            waliKelas: users,
        })
        .from(tabunganKelas)
        .leftJoin(users, eq(tabunganKelas.waliKelas, users.id))
        .limit(perPage)
        .offset(offset)
        .orderBy(asc(tabunganKelas.nama));

    const items = rows.map(({ kelas, waliKelas }) => ({
        ...kelas,
        waliKelasUser: waliKelas ? { name: waliKelas.fullName || waliKelas.name || "", email: waliKelas.email } : null,
    }));

    return { items, totalPages, totalItems };
}

export async function getAllKelas(): Promise<TabunganKelasWithRelations[]> {
    const rows = await db
        .select({
            kelas: tabunganKelas,
            waliKelas: users,
        })
        .from(tabunganKelas)
        .leftJoin(users, eq(tabunganKelas.waliKelas, users.id))
        .orderBy(asc(tabunganKelas.nama));

    return rows.map(({ kelas, waliKelas }) => ({
        ...kelas,
        waliKelasUser: waliKelas ? { name: waliKelas.fullName || waliKelas.name || "", email: waliKelas.email } : null,
    }));
}

export async function createKelas(data: TabunganKelasFormData) {
    const [newItem] = await db.insert(tabunganKelas).values({
        nama: data.nama,
        waliKelas: data.waliKelas,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any).returning();
    return newItem;
}

export async function updateKelas(id: string, data: Partial<TabunganKelasFormData>) {
    const [updated] = await db.update(tabunganKelas)
        .set({ ...data as any, updatedAt: new Date() })
        .where(eq(tabunganKelas.id, id))
        .returning();
    return updated;
}

export async function deleteKelas(id: string) {
    await db.delete(tabunganKelas).where(eq(tabunganKelas.id, id));
    return true;
}
