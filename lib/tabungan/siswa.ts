// ==========================================
// Tabungan Siswa CRUD Operations
// ==========================================
import "server-only";

import { db } from "@/db";
import { tabunganKelas, tabunganSiswa } from "@/db/schema/tabungan";
import { students } from "@/db/schema/students";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import type {
    TabunganSiswaWithRelations,
    TabunganSiswaFormData,
} from "@/types/tabungan";

export interface GetSiswaOptions {
    search?: string;
    kelasId?: string;
}

export async function getSiswa(
    page = 1,
    perPage = 20,
    options: GetSiswaOptions = {}
): Promise<{ items: TabunganSiswaWithRelations[]; totalPages: number; totalItems: number }> {
    const offset = (page - 1) * perPage;

    const conditions = [eq(tabunganSiswa.isActive, true)];

    if (options.kelasId && options.kelasId !== "all") {
        conditions.push(eq(tabunganSiswa.kelasId, options.kelasId));
    }

    if (options.search) {
        const s = `%${options.search}%`;
        conditions.push(sql`(${tabunganSiswa.nama} LIKE ${s} OR ${tabunganSiswa.nisn} LIKE ${s})`);
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tabunganSiswa)
        .where(whereClause);

    const totalItems = countResult.count;
    const totalPages = Math.ceil(totalItems / perPage);

    const rows = await db
        .select({
            siswa: tabunganSiswa,
            kelas: tabunganKelas,
        })
        .from(tabunganSiswa)
        .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
        .where(whereClause)
        .limit(perPage)
        .offset(offset)
        .orderBy(desc(tabunganSiswa.createdAt));

    const items = rows.map(({ siswa, kelas }) => ({
        ...siswa,
        kelas: kelas || null,
        saldo_terakhir: siswa.saldoTerakhir,
    }));

    return { items, totalPages, totalItems };
}

export async function getSiswaById(id: string): Promise<TabunganSiswaWithRelations | null> {
    const [row] = await db
        .select({
            siswa: tabunganSiswa,
            kelas: tabunganKelas,
        })
        .from(tabunganSiswa)
        .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
        .where(eq(tabunganSiswa.id, id))
        .limit(1);

    if (!row) return null;

    return {
        ...row.siswa,
        kelas: row.kelas || null,
    };
}

export async function getSiswaByQr(qrCode: string): Promise<TabunganSiswaWithRelations | null> {
    const [row] = await db
        .select({
            siswa: tabunganSiswa,
            kelas: tabunganKelas,
        })
        .from(tabunganSiswa)
        .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
        .where(and(eq(tabunganSiswa.qrCode, qrCode), eq(tabunganSiswa.isActive, true)))
        .limit(1);

    if (!row) return null;

    return {
        ...row.siswa,
        kelas: row.kelas || null,
    };
}

/**
 * Get tabungan siswa by student ID
 */
export async function getSiswaByStudentId(studentId: string): Promise<TabunganSiswaWithRelations | null> {
    const [row] = await db
        .select({
            siswa: tabunganSiswa,
            kelas: tabunganKelas,
        })
        .from(tabunganSiswa)
        .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
        .where(and(eq(tabunganSiswa.studentId, studentId), eq(tabunganSiswa.isActive, true)))
        .limit(1);

    if (!row) return null;

    return {
        ...row.siswa,
        kelas: row.kelas || null,
    };
}

/**
 * Get tabungan siswa by student's QR code
 * This looks up the student first, then finds the linked tabungan siswa
 */
export async function getSiswaByStudentQRCode(qrCode: string): Promise<TabunganSiswaWithRelations | null> {
    try {
        // Find student by QR code
        const [student] = await db.select()
            .from(students)
            .where(eq(students.qrCode, qrCode))
            .limit(1);
        
        if (!student) return null;
        
        // Find linked tabungan siswa
        return getSiswaByStudentId(student.id);
    } catch {
        return null;
    }
}

/**
 * Link an existing tabungan siswa to a student
 */
export async function linkSiswaToStudent(siswaId: string, studentId: string): Promise<any> {
    try {
        const [updated] = await db.update(tabunganSiswa)
            .set({ studentId, updatedAt: new Date() } as any)
            .where(eq(tabunganSiswa.id, siswaId))
            .returning();
        return updated;
    } catch {
        return null;
    }
}

export async function createSiswa(data: TabunganSiswaFormData) {
    const qrCode = `SIS-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const [newItem] = await db.insert(tabunganSiswa).values({
        ...data,
        qrCode,
        saldoTerakhir: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any).returning();
    return newItem;
}

export async function updateSiswa(id: string, data: Partial<TabunganSiswaFormData>) {
    const [updated] = await db.update(tabunganSiswa)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(tabunganSiswa.id, id))
        .returning();
    return updated;
}

export async function deleteSiswa(id: string) {
    await db.delete(tabunganSiswa).where(eq(tabunganSiswa.id, id));
    return true;
}

export async function getSiswaWithBalance(kelasId?: string): Promise<TabunganSiswaWithRelations[]> {
    const conditions = [eq(tabunganSiswa.isActive, true)];

    if (kelasId && kelasId !== "all") {
        conditions.push(eq(tabunganSiswa.kelasId, kelasId));
    }

    const rows = await db
        .select({
            siswa: tabunganSiswa,
            kelas: tabunganKelas,
        })
        .from(tabunganSiswa)
        .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
        .where(and(...conditions))
        .orderBy(asc(tabunganSiswa.nama));

    return rows.map(({ siswa, kelas }) => ({
        ...siswa,
        kelas: kelas || null,
        saldo_terakhir: siswa.saldoTerakhir,
    }));
}
