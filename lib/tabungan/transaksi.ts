// ==========================================
// Tabungan Transaksi (Transaction) Logic
// ==========================================
import "server-only";

import { db } from "@/db";
import { tabunganKelas, tabunganSiswa, tabunganTransaksi } from "@/db/schema/tabungan";
import { users } from "@/db/schema/users";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import type {
    TabunganTransaksiWithRelations,
    TabunganTransaksiFormData,
    TransactionStatus,
} from "@/types/tabungan";

export async function getTransaksi(
    page = 1,
    perPage = 20,
    options: {
        siswaId?: string;
        status?: TransactionStatus | "all";
        startDate?: string;
        endDate?: string;
        search?: string;
    } = {}
): Promise<{ items: TabunganTransaksiWithRelations[]; totalPages: number; totalItems: number }> {
    const offset = (page - 1) * perPage;
    
    const conditions = [];

    if (options.siswaId) {
        conditions.push(eq(tabunganTransaksi.siswaId, options.siswaId));
    }
    
    if (options.status && options.status !== "all") {
        conditions.push(eq(tabunganTransaksi.status, options.status));
    }

    if (options.search) {
        const s = `%${options.search}%`;
        conditions.push(sql`(${tabunganSiswa.nama} LIKE ${s} OR ${tabunganSiswa.nisn} LIKE ${s})`);
    }

    if (options.startDate) {
        const start = new Date(options.startDate);
        conditions.push(sql`${tabunganTransaksi.createdAt} >= ${start.getTime()}`); 
    }
    
    if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(sql`${tabunganTransaksi.createdAt} <= ${end.getTime()}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tabunganTransaksi)
        .where(whereClause);
        
    const totalItems = countResult.count;
    const totalPages = Math.ceil(totalItems / perPage);

    const rows = await db
        .select({
            transaksi: tabunganTransaksi,
            siswa: tabunganSiswa,
            user: users,
        })
        .from(tabunganTransaksi)
        .leftJoin(tabunganSiswa, eq(tabunganTransaksi.siswaId, tabunganSiswa.id))
        .leftJoin(users, eq(tabunganTransaksi.userId, users.id))
        .where(whereClause)
        .limit(perPage)
        .offset(offset)
        .orderBy(desc(tabunganTransaksi.createdAt));
    
    const items = rows.map(({ transaksi, siswa, user }) => ({
        ...transaksi,
        siswa: siswa || null,
        user: user ? { name: user.fullName || "", email: user.email } : null,
        verifier: null,
    }));

    return { items, totalPages, totalItems };
}

export async function getOpenTransactions(guruId: string): Promise<TabunganTransaksiWithRelations[]> {
    const rows = await db
        .select({
            transaksi: tabunganTransaksi,
            siswa: tabunganSiswa,
            kelas: tabunganKelas,
            user: users,
        })
        .from(tabunganTransaksi)
        .leftJoin(tabunganSiswa, eq(tabunganTransaksi.siswaId, tabunganSiswa.id))
        .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
        .leftJoin(users, eq(tabunganTransaksi.userId, users.id))
        .where(and(
            eq(tabunganTransaksi.userId, guruId),
            sql`${tabunganTransaksi.setoranId} IS NULL`,
            eq(tabunganTransaksi.status, "collected")
        ))
        .orderBy(desc(tabunganTransaksi.createdAt));

    return rows.map(({ transaksi, siswa, kelas, user }) => ({
        ...transaksi,
        siswa: siswa ? { ...siswa, kelas: kelas || null } : null,
        user: user ? { name: user.fullName || "", email: user.email } : null,
    })) as TabunganTransaksiWithRelations[];
}

export async function createTransaksi(
    data: TabunganTransaksiFormData,
    userId: string
) {
    return db.transaction((tx) => {
        // 1. Validate siswa exists
        const siswaRows = tx.select().from(tabunganSiswa).where(eq(tabunganSiswa.id, data.siswaId)).all();
        const siswa = siswaRows[0];
        if (!siswa) throw new Error("Siswa not found");

        // For withdrawals, check if student has sufficient pending balance
        const currentTipe = (data as any).type || (data as any).tipe;
        if (currentTipe === "tarik" && siswa.saldoTerakhir < data.nominal) {
            throw new Error("Saldo tidak cukup untuk penarikan");
        }

        // 2. Create Transaction with 'collected' status
        const [newTx] = tx.insert(tabunganTransaksi).values({
            ...data,
            tipe: currentTipe,
            userId,
            status: "collected",
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any).returning().all();

        return newTx;
    });
}

export async function getRecentTransactions(limit = 10): Promise<TabunganTransaksiWithRelations[]> {
    const rows = await db
        .select({
            transaksi: tabunganTransaksi,
            siswa: tabunganSiswa,
        })
        .from(tabunganTransaksi)
        .leftJoin(tabunganSiswa, eq(tabunganTransaksi.siswaId, tabunganSiswa.id))
        .orderBy(desc(tabunganTransaksi.createdAt))
        .limit(limit);
    
    return rows.map(({ transaksi, siswa }) => ({
        ...transaksi,
        siswa: siswa || null,
        user: null,
        verifier: null,
    }));
}
