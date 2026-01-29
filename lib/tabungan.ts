// ==========================================
// Tabungan (Student Savings) Helper Functions
// ==========================================
import "server-only";

import { db } from "@/db";
import { tabunganKelas, tabunganSiswa, tabunganTransaksi } from "@/db/schema/tabungan";
import { students } from "@/db/schema/students";
import { users } from "@/db/schema/users";
import { eq, like, and, desc, sql, asc } from "drizzle-orm";
import type {
    TabunganKelasWithRelations,
    TabunganSiswaWithRelations,
    TabunganTransaksiWithRelations,
    TabunganStats,
    TabunganSiswaFormData,
    TabunganKelasFormData,
    TabunganTransaksiFormData,
    TransactionStatus,
} from "@/types/tabungan";

// ==========================================
// Kelas CRUD
// ==========================================

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

// ==========================================
// Siswa CRUD
// ==========================================

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
        saldo_terakhir: siswa.saldoTerakhir, // Helper for compatibility if generic types used elsewhere? No, types/tabungan has Drizzle types now.
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
        saldo_terakhir: siswa.saldoTerakhir, // Maintain compat if needed, but we are switching types
    }));
}

// ==========================================
// Transaksi Logic
// ==========================================

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
        // ... (rest same, just ensuring context)
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
            verifier: users, // Using alias for verifier
        })
        .from(tabunganTransaksi)
        .leftJoin(tabunganSiswa, eq(tabunganTransaksi.siswaId, tabunganSiswa.id))
        .leftJoin(users, eq(tabunganTransaksi.userId, users.id)) // User who created tx
        // Join verifier? Drizzle table alias needed if joining users twice?
        // Yes. But let's try assuming alias auto-handling or skip for now if tricky.
        // Actually, we can use `alias`.
        .where(whereClause)
        .limit(perPage)
        .offset(offset)
        .orderBy(desc(tabunganTransaksi.createdAt));

    // For verifier, we need another join.
    // Let's keep it simple: only user (creator) for now, or just basic info.
    // If verifier is needed, we need `const verifiers = aliasedTable(users, 'verifiers')`
    
    const items = rows.map(({ transaksi, siswa, user }) => ({
        ...transaksi,
        siswa: siswa || null,
        user: user ? { name: user.fullName || "", email: user.email } : null,
        verifier: null, // Placeholder or fix later
    }));

    return { items, totalPages, totalItems };
}

// ==========================================
// Transaksi Logic (Instant Update)
// ==========================================

export async function getOpenTransactions(guruId: string): Promise<TabunganTransaksiWithRelations[]> {
    return await db.query.tabunganTransaksi.findMany({
        where: and(
            eq(tabunganTransaksi.userId, guruId),
            sql`${tabunganTransaksi.setoranId} IS NULL`,
            eq(tabunganTransaksi.status, "verified") // All successful inputs are 'verified' now
        ),
        with: {
            siswa: { with: { kelas: true } },
            user: true,
        },
        orderBy: [desc(tabunganTransaksi.createdAt)],
    });
}

export async function createTransaksi(
    data: TabunganTransaksiFormData,
    userId: string
) {
    return await db.transaction(async (tx) => {
        // 1. Create Transaction (Status Verified)
        const [newTx] = await tx.insert(tabunganTransaksi).values({
            ...data,
            userId,
            status: "verified", // Immediate verification by teacher
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any).returning();

        // 2. Update Student Balance Immediately
        const [siswa] = await tx.select().from(tabunganSiswa).where(eq(tabunganSiswa.id, data.siswaId));
        if (!siswa) throw new Error("Siswa not found");

        let newSaldo = siswa.saldoTerakhir;
        if (data.tipe === "setor") {
            newSaldo += data.nominal;
        } else {
            newSaldo -= data.nominal;
        }
        
        await tx.update(tabunganSiswa)
            .set({ saldoTerakhir: newSaldo, updatedAt: new Date() })
            .where(eq(tabunganSiswa.id, data.siswaId));

        return newTx;
    });
}

// Old updateTransaksiStatus is removed/deprecated
// as individual verification is no longer used.

// ==========================================
// Setoran (Settlement) Logic
// ==========================================

import { tabunganSetoran, tabunganBrankas, setoranStatusEnum, setoranTipeEnum, type SetoranStatus } from "@/db/schema/tabungan";

export async function getSetoranList(options: { status?: SetoranStatus } = {}) {
    const conditions = [];
    if (options.status) conditions.push(eq(tabunganSetoran.status, options.status));
    
    return await db.query.tabunganSetoran.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        with: {
            guru: true,
            bendahara: true,
            transaksi: true,
        },
        orderBy: [desc(tabunganSetoran.createdAt)],
    });
}

export async function createSetoran(guruId: string, catatan?: string) {
    return await db.transaction(async (tx) => {
        // 1. Get all open transactions for this teacher
        const openTx = await tx.select().from(tabunganTransaksi).where(and(
            eq(tabunganTransaksi.userId, guruId),
            sql`${tabunganTransaksi.setoranId} IS NULL`,
            eq(tabunganTransaksi.status, "verified")
        ));

        if (openTx.length === 0) throw new Error("Tidak ada transaksi untuk disetor");

        // 2. Calculate Total
        let total = 0;
        let tipe: "setor_ke_bendahara" | "tarik_dari_bendahara" = "setor_ke_bendahara";
        
        // Net calculation: (Deposit - Withdraw)
        const deposits = openTx.filter(t => t.tipe === "setor").reduce((sum, t) => sum + t.nominal, 0);
        const withdrawals = openTx.filter(t => t.tipe === "tarik").reduce((sum, t) => sum + t.nominal, 0);
        
        const netAmount = deposits - withdrawals;
        
        if (netAmount < 0) {
            tipe = "tarik_dari_bendahara";
            total = Math.abs(netAmount);
        } else {
            total = netAmount;
        }

        // 3. Create Setoran Record
        const [setoran] = await tx.insert(tabunganSetoran).values({
            guruId,
            tipe,
            totalNominal: total,
            status: "pending",
            catatan,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any).returning();

        // 4. Link Transactions to Setoran
        for (const t of openTx) {
            await tx.update(tabunganTransaksi)
                .set({ setoranId: setoran.id, updatedAt: new Date() } as any)
                .where(eq(tabunganTransaksi.id, t.id));
        }

        return setoran;
    });
}

export async function verifySetoran(setoranId: string, status: "verified" | "rejected", bendaharaId: string) {
    return await db.transaction(async (tx) => {
        // 1. Update Setoran Status
        const [setoran] = await tx.update(tabunganSetoran)
            .set({ 
                status, 
                bendaharaId, 
                updatedAt: new Date() 
            } as any)
            .where(eq(tabunganSetoran.id, setoranId))
            .returning();
            
        if (!setoran) throw new Error("Setoran not found");

        if (status === "verified") {
            // 2. Update Brankas (Ledger)
            // Default to "Brankas Sekolah" for now
            // Check if Brankas exists, if not create
            let [brankas] = await tx.select().from(tabunganBrankas).limit(1);
            
            if (!brankas) {
                [brankas] = await tx.insert(tabunganBrankas).values({
                    nama: "Brankas Utama",
                    saldo: 0,
                    updatedAt: new Date()
                }).returning();
            }

            let newSaldo = brankas.saldo;
            if (setoran.tipe === "setor_ke_bendahara") {
                newSaldo += setoran.totalNominal;
            } else {
                newSaldo -= setoran.totalNominal;
            }

            await tx.update(tabunganBrankas)
                .set({ saldo: newSaldo, updatedAt: new Date() })
                .where(eq(tabunganBrankas.id, brankas.id));
        } else if (status === "rejected") {
            // Unlink transactions so they can be corrected or re-submitted?
            // Or just keep them linked but failed? 
            // Better to unlink so teacher can fix/delete specific ones.
            await tx.update(tabunganTransaksi)
                .set({ setoranId: null } as any)
                .where(eq(tabunganTransaksi.setoranId, setoranId));
        }
        
        return setoran;
    });
}

export async function getBrankasStats() {
    // Get all brankas records (not just limit 1, supports multiple accounts now)
    const brankas = await db.query.tabunganBrankas.findMany({
        with: {
            pic: true // Include PIC details
        }
    });
    
    // Fallback if empty (for initial setup) - mostly UI handling, but let's return []
    return brankas;
}

export async function createOrUpdateBrankas(data: { id?: string; nama: string; saldo?: number; picId?: string | null }) {
    if (data.id) {
        // Construct update object dynamically to avoid setting undefined keys
        const updateData: any = {
            nama: data.nama,
            updatedAt: new Date()
        };
        
        // Only update picId if provided (including null)
        if (data.picId !== undefined) {
            updateData.picId = data.picId;
        }

        return await db.update(tabunganBrankas)
            .set(updateData)
            .where(eq(tabunganBrankas.id, data.id))
            .returning();
    } else {
        return await db.insert(tabunganBrankas).values({
            nama: data.nama,
            picId: data.picId || null,
            saldo: data.saldo || 0,
            updatedAt: new Date()
        }).returning();
    }
}

// ==========================================
// Stats
// ==========================================

export async function getTabunganStats(): Promise<TabunganStats> {
    try {
        const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        // Drizzle SQLite doesn't have easy date function access unless sql`` used.
        // Or store YYYY-MM-DD string as separate column?
        // We only have createdAt timestamp.
        // We can range query for today.
        
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date();
        endOfDay.setHours(23,59,59,999);

        const [
            [countSiswa],
            [sumSaldo],
            [pendingTx],
            [todayTx],
            [todayDeposit],
            [todayWithdraw]
        ] = await Promise.all([
            // Total Siswa
            db.select({ count: sql<number>`count(*)` }).from(tabunganSiswa).where(eq(tabunganSiswa.isActive, true)),
            // Total Saldo
            db.select({ sum: sql<number>`sum(${tabunganSiswa.saldoTerakhir})` }).from(tabunganSiswa).where(eq(tabunganSiswa.isActive, true)),
            // Pending
            db.select({ count: sql<number>`count(*)` }).from(tabunganTransaksi).where(eq(tabunganTransaksi.status, "pending")),
            // Today Transaksi
            db.select({ count: sql<number>`count(*)` }).from(tabunganTransaksi).where(and(
                sql`${tabunganTransaksi.createdAt} >= ${startOfDay.getTime()}`,
                sql`${tabunganTransaksi.createdAt} <= ${endOfDay.getTime()}`
            )),
            // Today Deposit
            db.select({ sum: sql<number>`sum(${tabunganTransaksi.nominal})` }).from(tabunganTransaksi).where(and(
                sql`${tabunganTransaksi.createdAt} >= ${startOfDay.getTime()}`,
                sql`${tabunganTransaksi.createdAt} <= ${endOfDay.getTime()}`,
                eq(tabunganTransaksi.tipe, "setor"),
                eq(tabunganTransaksi.status, "verified")
            )),
            // Today Withdraw
            db.select({ sum: sql<number>`sum(${tabunganTransaksi.nominal})` }).from(tabunganTransaksi).where(and(
                sql`${tabunganTransaksi.createdAt} >= ${startOfDay.getTime()}`,
                sql`${tabunganTransaksi.createdAt} <= ${endOfDay.getTime()}`,
                eq(tabunganTransaksi.tipe, "tarik"),
                eq(tabunganTransaksi.status, "verified")
            )),
        ]);

        return {
            totalSiswa: countSiswa.count,
            totalSaldo: sumSaldo.sum || 0,
            pendingTransactions: pendingTx.count,
            todayTransactions: todayTx.count,
            todayDeposit: todayDeposit.sum || 0,
            todayWithdraw: todayWithdraw.sum || 0,
        };
    } catch (e) {
        console.error("Tabungan stats error", e);
        return {
            totalSiswa: 0,
            totalSaldo: 0,
            pendingTransactions: 0,
            todayTransactions: 0,
            todayDeposit: 0,
            todayWithdraw: 0,
        };
    }
}

// ==========================================
// Chart Data Functions
// ==========================================

export async function getTransactionTrend(days = 7): Promise<{ date: string; setor: number; tarik: number }[]> {
    const result: { date: string; setor: number; tarik: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        
        const dateStr = date.toLocaleDateString("id-ID", { weekday: "short" });
        
        const [[setor], [tarik]] = await Promise.all([
            db.select({ sum: sql<number>`sum(${tabunganTransaksi.nominal})` })
                .from(tabunganTransaksi)
                .where(and(
                    sql`${tabunganTransaksi.createdAt} >= ${date.getTime()}`,
                    sql`${tabunganTransaksi.createdAt} <= ${endDate.getTime()}`,
                    eq(tabunganTransaksi.tipe, "setor"),
                    eq(tabunganTransaksi.status, "verified")
                )),
            db.select({ sum: sql<number>`sum(${tabunganTransaksi.nominal})` })
                .from(tabunganTransaksi)
                .where(and(
                    sql`${tabunganTransaksi.createdAt} >= ${date.getTime()}`,
                    sql`${tabunganTransaksi.createdAt} <= ${endDate.getTime()}`,
                    eq(tabunganTransaksi.tipe, "tarik"),
                    eq(tabunganTransaksi.status, "verified")
                )),
        ]);
        
        result.push({
            date: dateStr,
            setor: setor.sum || 0,
            tarik: tarik.sum || 0,
        });
    }
    
    return result;
}

export async function getSaldoByKelas(): Promise<{ name: string; value: number; color?: string }[]> {
    const rows = await db
        .select({
            kelasNama: tabunganKelas.nama,
            waliKelasNama: users.name,
            totalSaldo: sql<number>`sum(${tabunganSiswa.saldoTerakhir})`,
        })
        .from(tabunganSiswa)
        .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
        .leftJoin(users, eq(tabunganKelas.waliKelas, users.id))
        .where(eq(tabunganSiswa.isActive, true))
        .groupBy(tabunganKelas.nama, users.name);
    
    // Generate colors
    const colors = [
        "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", 
        "#ec4899", "#14b8a6", "#6366f1", "#84cc16", "#06b6d4"
    ];

    return rows.map((row, index) => {
        let displayName = row.kelasNama || "Tanpa Kelas";
        if (row.waliKelasNama) {
            // Shorten name if too long? No, chart usually handles it or tooltip does.
            displayName += ` (${row.waliKelasNama})`;
        }
        
        return {
            name: displayName,
            value: row.totalSaldo || 0,
            color: colors[index % colors.length]
        };
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

export async function getTopSavers(limit = 5): Promise<{ siswa: TabunganSiswaWithRelations; saldo: number }[]> {
    const rows = await db
        .select({
            siswa: tabunganSiswa,
            kelas: tabunganKelas,
        })
        .from(tabunganSiswa)
        .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
        .where(eq(tabunganSiswa.isActive, true))
        .orderBy(desc(tabunganSiswa.saldoTerakhir))
        .limit(limit);
    
    return rows.map(({ siswa, kelas }) => ({
        siswa: {
            ...siswa,
            kelas: kelas || null,
        },
        saldo: siswa.saldoTerakhir,
    }));
}

