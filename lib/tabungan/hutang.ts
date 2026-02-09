// ==========================================
// Tabungan Hutang (Student Debts) Functions
// ==========================================
import "server-only";

import { db } from "@/db";
import { tabunganKelas, tabunganSiswa, tabunganTransaksi, tabunganHutang, type HutangStatus, type HutangKategori } from "@/db/schema/tabungan";
import { users } from "@/db/schema/users";
import { eq, and, desc, sql } from "drizzle-orm";

export interface HutangFormData {
    siswaId: string;
    namaBarang: string;
    kategori?: HutangKategori;
    nominal: number;
    jumlah?: number;
    tanggalAmbil?: Date;
    catatan?: string;
    tahunAjaran?: string;
}

export interface TabunganHutangWithRelations {
    id: string;
    siswaId: string;
    namaBarang: string;
    kategori: HutangKategori;
    nominal: number;
    jumlah: number;
    dicatatOleh: string;
    tanggalAmbil: Date | null;
    catatan: string | null;
    status: HutangStatus;
    dilunaskanDari: string | null;
    tanggalLunas: Date | null;
    dilunaskanOleh: string | null;
    tahunAjaran: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    siswa?: { nama: string; nisn: string; kelasId: string } | null;
    pencatat?: { name: string; email: string } | null;
}

export async function createHutang(data: HutangFormData, userId: string) {
    const [hutang] = await db.insert(tabunganHutang).values({
        siswaId: data.siswaId,
        namaBarang: data.namaBarang,
        kategori: data.kategori || "lainnya",
        nominal: data.nominal,
        jumlah: data.jumlah || 1,
        dicatatOleh: userId,
        tanggalAmbil: data.tanggalAmbil || new Date(),
        catatan: data.catatan,
        tahunAjaran: data.tahunAjaran,
        status: "aktif",
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any).returning();
    return hutang;
}

export async function getHutangBySiswa(siswaId: string): Promise<TabunganHutangWithRelations[]> {
    const rows = await db
        .select({
            hutang: tabunganHutang,
            siswa: tabunganSiswa,
            pencatat: users,
        })
        .from(tabunganHutang)
        .leftJoin(tabunganSiswa, eq(tabunganHutang.siswaId, tabunganSiswa.id))
        .leftJoin(users, eq(tabunganHutang.dicatatOleh, users.id))
        .where(eq(tabunganHutang.siswaId, siswaId))
        .orderBy(desc(tabunganHutang.tanggalAmbil));
    
    return rows.map(({ hutang, siswa, pencatat }) => ({
        ...hutang,
        siswa: siswa ? { nama: siswa.nama, nisn: siswa.nisn, kelasId: siswa.kelasId } : null,
        pencatat: pencatat ? { name: pencatat.fullName || pencatat.name || "", email: pencatat.email } : null,
    }));
}

export async function getHutangAktifBySiswa(siswaId: string): Promise<TabunganHutangWithRelations[]> {
    const rows = await db
        .select({
            hutang: tabunganHutang,
            siswa: tabunganSiswa,
            pencatat: users,
        })
        .from(tabunganHutang)
        .leftJoin(tabunganSiswa, eq(tabunganHutang.siswaId, tabunganSiswa.id))
        .leftJoin(users, eq(tabunganHutang.dicatatOleh, users.id))
        .where(and(
            eq(tabunganHutang.siswaId, siswaId),
            eq(tabunganHutang.status, "aktif")
        ))
        .orderBy(desc(tabunganHutang.tanggalAmbil));
    
    return rows.map(({ hutang, siswa, pencatat }) => ({
        ...hutang,
        siswa: siswa ? { nama: siswa.nama, nisn: siswa.nisn, kelasId: siswa.kelasId } : null,
        pencatat: pencatat ? { name: pencatat.fullName || pencatat.name || "", email: pencatat.email } : null,
    }));
}

export async function getTotalHutangAktif(siswaId: string): Promise<number> {
    const [result] = await db
        .select({
            total: sql<number>`coalesce(sum(${tabunganHutang.nominal} * ${tabunganHutang.jumlah}), 0)`
        })
        .from(tabunganHutang)
        .where(and(
            eq(tabunganHutang.siswaId, siswaId),
            eq(tabunganHutang.status, "aktif")
        ));
    return result?.total || 0;
}

export async function getSaldoEfektif(siswaId: string): Promise<{ saldo: number; hutang: number; efektif: number }> {
    const siswa = await db.query.tabunganSiswa.findFirst({
        where: eq(tabunganSiswa.id, siswaId),
    });
    const saldo = siswa?.saldoTerakhir || 0;
    const hutang = await getTotalHutangAktif(siswaId);
    return {
        saldo,
        hutang,
        efektif: saldo - hutang,
    };
}

export async function updateHutang(id: string, data: Partial<HutangFormData>) {
    const [updated] = await db.update(tabunganHutang)
        .set({
            ...(data.namaBarang && { namaBarang: data.namaBarang }),
            ...(data.kategori && { kategori: data.kategori }),
            ...(data.nominal && { nominal: data.nominal }),
            ...(data.jumlah && { jumlah: data.jumlah }),
            ...(data.catatan !== undefined && { catatan: data.catatan }),
            ...(data.tahunAjaran && { tahunAjaran: data.tahunAjaran }),
            updatedAt: new Date(),
        } as any)
        .where(and(
            eq(tabunganHutang.id, id),
            eq(tabunganHutang.status, "aktif")
        ))
        .returning();
    return updated;
}

export async function cancelHutang(id: string, userId: string) {
    const [updated] = await db.update(tabunganHutang)
        .set({
            status: "dibatalkan",
            dilunaskanOleh: userId,
            tanggalLunas: new Date(),
            updatedAt: new Date(),
        } as any)
        .where(eq(tabunganHutang.id, id))
        .returning();
    return updated;
}

export async function payHutangCash(id: string, userId: string) {
    const [updated] = await db.update(tabunganHutang)
        .set({
            status: "lunas",
            dilunaskanDari: "cash",
            dilunaskanOleh: userId,
            tanggalLunas: new Date(),
            updatedAt: new Date(),
        } as any)
        .where(eq(tabunganHutang.id, id))
        .returning();
    return updated;
}

export async function settleHutangFromTabungan(siswaId: string, userId: string, catatan?: string) {
    return db.transaction((tx) => {
        // Get student's current balance
        const siswaRows = tx.select().from(tabunganSiswa).where(eq(tabunganSiswa.id, siswaId)).all();
        const siswa = siswaRows[0];
        if (!siswa) throw new Error("Siswa tidak ditemukan");

        // Get all active debts
        const activeDebts = tx.select().from(tabunganHutang)
            .where(and(
                eq(tabunganHutang.siswaId, siswaId),
                eq(tabunganHutang.status, "aktif")
            ))
            .all();

        if (activeDebts.length === 0) {
            return { success: true, message: "Tidak ada hutang aktif", settled: 0, remaining: 0 };
        }

        const totalDebt = activeDebts.reduce((sum, d) => sum + (d.nominal * d.jumlah), 0);
        const currentBalance = siswa.saldoTerakhir;
        const amountToPay = Math.min(totalDebt, currentBalance);
        const remaining = totalDebt - amountToPay;

        if (amountToPay > 0) {
            // Create withdrawal transaction
            tx.insert(tabunganTransaksi).values({
                siswaId: siswaId,
                userId: userId,
                tipe: "tarik",
                nominal: amountToPay,
                status: "verified",
                catatan: catatan || `Pelunasan Hutang Atribut/Buku T.A. ${activeDebts[0]?.tahunAjaran || new Date().getFullYear()}`,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any).run();

            // Update student balance
            tx.update(tabunganSiswa)
                .set({ 
                    saldoTerakhir: currentBalance - amountToPay,
                    updatedAt: new Date() 
                })
                .where(eq(tabunganSiswa.id, siswaId))
                .run();

            // Mark all debts as paid
            for (const debt of activeDebts) {
                tx.update(tabunganHutang)
                    .set({
                        status: "lunas",
                        dilunaskanDari: "tabungan",
                        dilunaskanOleh: userId,
                        tanggalLunas: new Date(),
                        updatedAt: new Date(),
                    } as any)
                    .where(eq(tabunganHutang.id, debt.id))
                    .run();
            }
        }

        return {
            success: true,
            settled: amountToPay,
            remaining: remaining,
            newBalance: currentBalance - amountToPay,
            debtsCleared: activeDebts.length,
            status: remaining > 0 ? "KURANG_BAYAR" : "LUNAS"
        };
    });
}

export async function getHutangList(options: {
    status?: HutangStatus;
    kelasId?: string;
    tahunAjaran?: string;
    page?: number;
    perPage?: number;
} = {}) {
    const { status, kelasId, tahunAjaran, page = 1, perPage = 20 } = options;
    const offset = (page - 1) * perPage;

    const conditions = [];
    if (status) conditions.push(eq(tabunganHutang.status, status));
    if (tahunAjaran) conditions.push(eq(tabunganHutang.tahunAjaran, tahunAjaran));
    
    let query = db
        .select({
            hutang: tabunganHutang,
            siswa: tabunganSiswa,
            kelas: tabunganKelas,
            pencatat: users,
        })
        .from(tabunganHutang)
        .leftJoin(tabunganSiswa, eq(tabunganHutang.siswaId, tabunganSiswa.id))
        .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
        .leftJoin(users, eq(tabunganHutang.dicatatOleh, users.id))
        .orderBy(desc(tabunganHutang.createdAt))
        .limit(perPage)
        .offset(offset);

    if (conditions.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.where(and(...conditions)) as any;
    }
    if (kelasId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.where(eq(tabunganSiswa.kelasId, kelasId)) as any;
    }

    const rows = await query;

    return rows.map(({ hutang, siswa, kelas, pencatat }) => ({
        ...hutang,
        siswa: siswa ? { 
            id: siswa.id,
            nama: siswa.nama, 
            nisn: siswa.nisn, 
            kelasId: siswa.kelasId,
            kelas: kelas?.nama || null,
        } : null,
        pencatat: pencatat ? { name: pencatat.fullName || pencatat.name || "", email: pencatat.email } : null,
    }));
}

export async function createHutangBatch(
    data: {
        siswaIds: string[];
        namaBarang: string;
        kategori: HutangKategori;
        nominal: number;
        jumlah?: number;
        catatan?: string;
        tahunAjaran?: string;
    },
    userId: string
) {
    if (!data.siswaIds.length) return { success: true, count: 0 };

    const batchData = data.siswaIds.map(siswaId => ({
        siswaId,
        namaBarang: data.namaBarang,
        kategori: data.kategori || "lainnya",
        nominal: data.nominal,
        jumlah: data.jumlah || 1,
        dicatatOleh: userId,
        tanggalAmbil: new Date(),
        catatan: data.catatan,
        tahunAjaran: data.tahunAjaran,
        status: "aktif" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
    }));

    return db.transaction(async (tx) => {
        const result = await tx.insert(tabunganHutang).values(batchData).returning();
        return { success: true, count: result.length, items: result };
    });
}
