// ==========================================
// Tabungan (Student Savings) Helper Functions
// ==========================================
import "server-only";

import { db } from "@/db";
import { tabunganKelas, tabunganSiswa, tabunganTransaksi } from "@/db/schema/tabungan";
import { students } from "@/db/schema/students";
import { users } from "@/db/schema/users";
import { eq, like, and, or, inArray, desc, sql, asc, gte, lte } from "drizzle-orm";
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
        // Saldo will NOT be updated here - it will be updated when Bendahara approves the batch
        const [newTx] = tx.insert(tabunganTransaksi).values({
            ...data,
            tipe: currentTipe,
            userId,
            status: "collected", // Changed from "verified" - part of Batch Settlement workflow
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any).returning().all();

        // NOTE: Student balance (saldoTerakhir) is NOT updated here anymore.
        // It will be updated in verifySetoran() when the batch is approved by Bendahara.
        // This ensures data integrity and prevents "ghost" balances.

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

export async function getSetoranByGuru(guruId: string, options: { status?: SetoranStatus } = {}) {
    const conditions = [eq(tabunganSetoran.guruId, guruId)];
    if (options.status) conditions.push(eq(tabunganSetoran.status, options.status));
    
    return await db.query.tabunganSetoran.findMany({
        where: and(...conditions),
        with: {
            guru: true,
            bendahara: true,
            transaksi: true,
        },
        orderBy: [desc(tabunganSetoran.createdAt)],
    });
}

export async function createSetoran(guruId: string, catatan?: string) {
    return db.transaction((tx) => {
        // 1. Get all open transactions for this teacher (status: collected, not yet in a batch)
        const openTx = tx.select().from(tabunganTransaksi).where(and(
            eq(tabunganTransaksi.userId, guruId),
            sql`${tabunganTransaksi.setoranId} IS NULL`,
            eq(tabunganTransaksi.status, "collected")
        )).all();

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
        const [setoran] = tx.insert(tabunganSetoran).values({
            guruId,
            tipe,
            totalNominal: total,
            status: "pending",
            catatan,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any).returning().all();

        // 4. Link Transactions to Setoran
        for (const t of openTx) {
            tx.update(tabunganTransaksi)
                .set({ setoranId: setoran.id, updatedAt: new Date() } as any)
                .where(eq(tabunganTransaksi.id, t.id))
                .run();
        }

        return setoran;
    });
}

export async function verifySetoran(
    setoranId: string,
    status: "verified" | "rejected",
    bendaharaId: string,
    nominalFisik?: number,
    catatan?: string
) {
    return db.transaction((tx) => {
        // 1. Fetch current setoran
        const existingRows = tx.select().from(tabunganSetoran).where(eq(tabunganSetoran.id, setoranId)).limit(1).all();
        const existing = existingRows[0];
        if (!existing) throw new Error("Setoran not found");

        const fisik = nominalFisik ?? existing.totalNominal;
        const selisih = existing.totalNominal - fisik;

        // 2. Update Setoran Status & Discrepancy
        const [setoran] = tx.update(tabunganSetoran)
            .set({ 
                status, 
                bendaharaId, 
                nominalFisik: fisik,
                selisih: selisih,
                catatan: catatan ?? existing.catatan,
                updatedAt: new Date() 
            } as any)
            .where(eq(tabunganSetoran.id, setoranId))
            .returning().all();

        if (status === "verified") {
            // 3. Get all transactions in this batch
            const batchTransactions = tx.select().from(tabunganTransaksi)
                .where(eq(tabunganTransaksi.setoranId, setoranId))
                .all();

            // 4. Update each transaction status to 'verified' and update student saldo
            for (const txn of batchTransactions) {
                // Update transaction status
                tx.update(tabunganTransaksi)
                    .set({ status: "verified", updatedAt: new Date() } as any)
                    .where(eq(tabunganTransaksi.id, txn.id))
                    .run();

                // Update student saldo
                const siswaRows = tx.select().from(tabunganSiswa)
                    .where(eq(tabunganSiswa.id, txn.siswaId))
                    .all();
                const siswa = siswaRows[0];
                
                if (siswa) {
                    let newSaldo = siswa.saldoTerakhir;
                    if (txn.tipe === "setor") {
                        newSaldo += txn.nominal;
                    } else {
                        newSaldo -= txn.nominal;
                    }
                    
                    tx.update(tabunganSiswa)
                        .set({ saldoTerakhir: newSaldo, updatedAt: new Date() })
                        .where(eq(tabunganSiswa.id, txn.siswaId))
                        .run();
                }
            }

            // 5. Update Brankas (Ledger)
            // We use the Physical Cash (fisik) as the amount entering the treasury
            let brankasRows = tx.select().from(tabunganBrankas).where(eq(tabunganBrankas.tipe, "cash")).limit(1).all();
            let brankas = brankasRows[0];
            
            if (!brankas) {
                const brankasNew = tx.insert(tabunganBrankas).values({
                    nama: "Kas Bendahara (Tunai)",
                    tipe: "cash",
                    saldo: 0,
                    updatedAt: new Date()
                } as any).returning().all();
                brankas = brankasNew[0];
            }

            let newSaldo = brankas.saldo;
            if (setoran.tipe === "setor_ke_bendahara") {
                newSaldo += fisik;
            } else {
                newSaldo -= fisik;
            }

            tx.update(tabunganBrankas)
                .set({ saldo: newSaldo, updatedAt: new Date() })
                .where(eq(tabunganBrankas.id, brankas.id))
                .run();

            // 6. Record Brankas Transaction (Mutation History)
            tx.insert(tabunganBrankasTransaksi).values({
                tipe: setoran.tipe === "setor_ke_bendahara" ? "setor_ke_koperasi" : "tarik_dari_koperasi", 
                nominal: fisik,
                userId: bendaharaId,
                catatan: `Setoran Harian verified: ${catatan || '-'}`,
                createdAt: new Date(),
            } as any).run();
        } else if (status === "rejected") {
            // Keep transactions linked to setoran for editing
            // Don't unlink them - teacher can edit and resubmit
            // Just update transaction status to indicate rejection
            tx.update(tabunganTransaksi)
                .set({ status: "rejected", updatedAt: new Date() } as any)
                .where(eq(tabunganTransaksi.setoranId, setoranId))
                .run();
        }
        
        return setoran;
    });
}

/**
 * Update a transaction within a rejected batch.
 * When a transaction is edited, the batch total is recalculated.
 */
export async function updateTransaksiInBatch(
    transaksiId: string,
    data: { nominal?: number; catatan?: string }
) {
    return db.transaction((tx) => {
        // 1. Get the transaction
        const txnRows = tx.select().from(tabunganTransaksi)
            .where(eq(tabunganTransaksi.id, transaksiId))
            .all();
        const txn = txnRows[0];
        if (!txn) throw new Error("Transaksi tidak ditemukan");
        if (!txn.setoranId) throw new Error("Transaksi tidak terhubung ke setoran");

        // 2. Get the setoran
        const setoranRows = tx.select().from(tabunganSetoran)
            .where(eq(tabunganSetoran.id, txn.setoranId))
            .all();
        const setoran = setoranRows[0];
        if (!setoran) throw new Error("Setoran tidak ditemukan");
        if (setoran.status !== "rejected") {
            throw new Error("Hanya dapat mengedit transaksi dalam setoran yang ditolak");
        }

        // 3. Update the transaction
        const [updatedTxn] = tx.update(tabunganTransaksi)
            .set({
                nominal: data.nominal ?? txn.nominal,
                catatan: data.catatan ?? txn.catatan,
                status: "collected", // Reset to collected for resubmission
                updatedAt: new Date()
            } as any)
            .where(eq(tabunganTransaksi.id, transaksiId))
            .returning().all();

        // 4. Recalculate batch total
        const allTxInBatch = tx.select().from(tabunganTransaksi)
            .where(eq(tabunganTransaksi.setoranId, txn.setoranId))
            .all();

        const deposits = allTxInBatch.filter(t => t.tipe === "setor").reduce((sum, t) => sum + t.nominal, 0);
        const withdrawals = allTxInBatch.filter(t => t.tipe === "tarik").reduce((sum, t) => sum + t.nominal, 0);
        const netAmount = deposits - withdrawals;

        let tipe: "setor_ke_bendahara" | "tarik_dari_bendahara" = "setor_ke_bendahara";
        let total = netAmount;
        if (netAmount < 0) {
            tipe = "tarik_dari_bendahara";
            total = Math.abs(netAmount);
        }

        // 5. Update setoran total
        tx.update(tabunganSetoran)
            .set({ totalNominal: total, tipe, updatedAt: new Date() } as any)
            .where(eq(tabunganSetoran.id, txn.setoranId))
            .run();

        return updatedTxn;
    });
}

/**
 * Resubmit a rejected setoran for re-verification.
 * Changes status from 'rejected' to 'pending'.
 */
export async function resubmitSetoran(setoranId: string, catatan?: string) {
    return db.transaction((tx) => {
        // 1. Get the setoran
        const setoranRows = tx.select().from(tabunganSetoran)
            .where(eq(tabunganSetoran.id, setoranId))
            .all();
        const setoran = setoranRows[0];
        if (!setoran) throw new Error("Setoran tidak ditemukan");
        if (setoran.status !== "rejected") {
            throw new Error("Hanya dapat mengajukan ulang setoran yang ditolak");
        }

        // 2. Reset transaction statuses to 'collected'
        tx.update(tabunganTransaksi)
            .set({ status: "collected", updatedAt: new Date() } as any)
            .where(eq(tabunganTransaksi.setoranId, setoranId))
            .run();

        // 3. Update setoran status to pending
        const [updated] = tx.update(tabunganSetoran)
            .set({ 
                status: "pending", 
                catatan: catatan ?? setoran.catatan,
                nominalFisik: null, // Reset
                selisih: 0,
                bendaharaId: null, // Reset
                updatedAt: new Date() 
            } as any)
            .where(eq(tabunganSetoran.id, setoranId))
            .returning().all();

        return updated;
    });
}

/**
 * Get setoran detail with all linked transactions
 */
export async function getSetoranDetail(setoranId: string) {
    const setoran = await db.query.tabunganSetoran.findFirst({
        where: eq(tabunganSetoran.id, setoranId),
        with: {
            guru: true,
            bendahara: true,
            transaksi: {
                with: {
                    siswa: true
                }
            }
        }
    });
    return setoran;
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

import { tabunganBrankasTransaksi, type BrankasTransaksiTipe } from "@/db/schema/tabungan";

export async function transferBrankas(
    fromId: string,
    toId: string,
    amount: number,
    userId: string,
    tipe: BrankasTransaksiTipe,
    catatan?: string
) {
    return db.transaction((tx) => {
        // 1. Update Origin
        const fromRows = tx.select().from(tabunganBrankas).where(eq(tabunganBrankas.id, fromId)).all();
        const fromBrankas = fromRows[0];
        if (!fromBrankas || fromBrankas.saldo < amount) throw new Error("Saldo tidak cukup");

        tx.update(tabunganBrankas)
            .set({ saldo: fromBrankas.saldo - amount, updatedAt: new Date() })
            .where(eq(tabunganBrankas.id, fromId))
            .run();

        // 2. Update Destination
        const toRows = tx.select().from(tabunganBrankas).where(eq(tabunganBrankas.id, toId)).all();
        const toBrankas = toRows[0];
        if (!toBrankas) throw new Error("Brankas tujuan tidak ditemukan");

        tx.update(tabunganBrankas)
            .set({ saldo: toBrankas.saldo + amount, updatedAt: new Date() })
            .where(eq(tabunganBrankas.id, toId))
            .run();

        // 3. Record Transaction
        const [trx] = tx.insert(tabunganBrankasTransaksi).values({
            tipe,
            nominal: amount,
            userId,
            catatan,
            createdAt: new Date(),
        } as any).returning().all();

        return trx;
    });
}

export async function createOrUpdateBrankas(data: { id?: string; nama: string; saldo?: number; picId?: string | null, tipe?: "cash" | "bank" }) {
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
                gte(tabunganTransaksi.createdAt, startOfDay),
                lte(tabunganTransaksi.createdAt, endOfDay)
            )),
            // Today Deposit
            db.select({ sum: sql<number>`sum(${tabunganTransaksi.nominal})` }).from(tabunganTransaksi).where(and(
                gte(tabunganTransaksi.createdAt, startOfDay),
                lte(tabunganTransaksi.createdAt, endOfDay),
                eq(tabunganTransaksi.tipe, "setor"),
                eq(tabunganTransaksi.status, "verified")
            )),
            // Today Withdraw
            db.select({ sum: sql<number>`sum(${tabunganTransaksi.nominal})` }).from(tabunganTransaksi).where(and(
                gte(tabunganTransaksi.createdAt, startOfDay),
                lte(tabunganTransaksi.createdAt, endOfDay),
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
                    gte(tabunganTransaksi.createdAt, date),
                    lte(tabunganTransaksi.createdAt, endDate),
                    eq(tabunganTransaksi.tipe, "setor"),
                    eq(tabunganTransaksi.status, "verified")
                )),
            db.select({ sum: sql<number>`sum(${tabunganTransaksi.nominal})` })
                .from(tabunganTransaksi)
                .where(and(
                    gte(tabunganTransaksi.createdAt, date),
                    lte(tabunganTransaksi.createdAt, endDate),
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

// ==========================================
// Hutang (Student Debts) Functions
// ==========================================

import { tabunganHutang, type HutangStatus, type HutangKategori } from "@/db/schema/tabungan";

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

/**
 * Create a new debt record
 */
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

/**
 * Get all hutang for a specific student
 */
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

/**
 * Get only active (unpaid) debts for a student
 */
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

/**
 * Get total active debts amount for a student
 */
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

/**
 * Get effective balance (saldo - active debts)
 */
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

/**
 * Update hutang details (only if still active)
 */
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
            eq(tabunganHutang.status, "aktif") // Only update if still active
        ))
        .returning();
    return updated;
}

/**
 * Cancel/delete a hutang (mark as dibatalkan)
 */
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

/**
 * Mark a hutang as paid via cash (not from tabungan)
 */
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

/**
 * Settlement: Pay off all active debts from student's savings balance
 * Creates a withdrawal transaction and marks debts as paid
 */
export async function settleHutangFromTabungan(siswaId: string, userId: string, catatan?: string) {
    return db.transaction((tx) => {
        // 1. Get student's current balance
        const siswaRows = tx.select().from(tabunganSiswa).where(eq(tabunganSiswa.id, siswaId)).all();
        const siswa = siswaRows[0];
        if (!siswa) throw new Error("Siswa tidak ditemukan");

        // 2. Get all active debts
        const activeDebts = tx.select().from(tabunganHutang)
            .where(and(
                eq(tabunganHutang.siswaId, siswaId),
                eq(tabunganHutang.status, "aktif")
            ))
            .all();

        if (activeDebts.length === 0) {
            return { success: true, message: "Tidak ada hutang aktif", settled: 0, remaining: 0 };
        }

        // 3. Calculate total debt
        const totalDebt = activeDebts.reduce((sum, d) => sum + (d.nominal * d.jumlah), 0);
        const currentBalance = siswa.saldoTerakhir;
        
        // 4. Determine how much can be paid
        const amountToPay = Math.min(totalDebt, currentBalance);
        const remaining = totalDebt - amountToPay;

        if (amountToPay > 0) {
            // 5. Create withdrawal transaction
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

            // 6. Update student balance
            tx.update(tabunganSiswa)
                .set({ 
                    saldoTerakhir: currentBalance - amountToPay,
                    updatedAt: new Date() 
                })
                .where(eq(tabunganSiswa.id, siswaId))
                .run();

            // 7. Mark all debts as paid from tabungan
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

/**
 * Generate comprehensive end-of-year report for a student
 */
export async function getStudentFinalReport(siswaId: string) {
    // 1. Get student info
    const siswa = await db.query.tabunganSiswa.findFirst({
        where: eq(tabunganSiswa.id, siswaId),
        with: { kelas: true },
    });
    if (!siswa) throw new Error("Siswa tidak ditemukan");

    // 2. Get all verified transactions
    const transactions = await db
        .select()
        .from(tabunganTransaksi)
        .where(and(
            eq(tabunganTransaksi.siswaId, siswaId),
            eq(tabunganTransaksi.status, "verified")
        ))
        .orderBy(asc(tabunganTransaksi.createdAt));

    // 3. Calculate savings summary by month
    const monthlySummary: { [key: string]: { setor: number; tarik: number } } = {};
    let totalSetor = 0;
    let totalTarik = 0;

    for (const tx of transactions) {
        const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlySummary[monthKey]) {
            monthlySummary[monthKey] = { setor: 0, tarik: 0 };
        }
        
        if (tx.tipe === "setor") {
            monthlySummary[monthKey].setor += tx.nominal;
            totalSetor += tx.nominal;
        } else {
            monthlySummary[monthKey].tarik += tx.nominal;
            totalTarik += tx.nominal;
        }
    }

    // 4. Get all debts (including settled ones for history)
    const allDebts = await getHutangBySiswa(siswaId);
    const activeDebts = allDebts.filter(d => d.status === "aktif");
    const totalDebt = activeDebts.reduce((sum, d) => sum + (d.nominal * d.jumlah), 0);

    // 5. Calculate net balance
    const currentBalance = siswa.saldoTerakhir;
    const netBalance = currentBalance - totalDebt;

    return {
        siswa: {
            id: siswa.id,
            nama: siswa.nama,
            nisn: siswa.nisn,
            kelas: siswa.kelas?.nama || "-",
        },
        tabungan: {
            monthlySummary,
            totalSetor,
            totalTarik,
            saldoAkhir: currentBalance,
        },
        hutang: {
            items: allDebts,
            activeItems: activeDebts,
            totalHutangAktif: totalDebt,
        },
        settlement: {
            netBalance,
            status: netBalance < 0 ? "KURANG_BAYAR" : "SIAP_CAIR",
            terbilang: numberToWords(Math.abs(netBalance)),
        },
        generatedAt: new Date(),
    };
}

/**
 * Get all hutang with filters (for admin view)
 */
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

/**
 * Helper: Convert number to Indonesian words
 */
function numberToWords(num: number): string {
    if (num === 0) return "Nol Rupiah";
    
    const units = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan"];
    const teens = ["Sepuluh", "Sebelas", "Dua Belas", "Tiga Belas", "Empat Belas", "Lima Belas", "Enam Belas", "Tujuh Belas", "Delapan Belas", "Sembilan Belas"];
    const tens = ["", "", "Dua Puluh", "Tiga Puluh", "Empat Puluh", "Lima Puluh", "Enam Puluh", "Tujuh Puluh", "Delapan Puluh", "Sembilan Puluh"];
    
    const convert = (n: number): string => {
        if (n < 10) return units[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + units[n % 10] : "");
        if (n < 200) return "Seratus" + (n % 100 ? " " + convert(n % 100) : "");
        if (n < 1000) return units[Math.floor(n / 100)] + " Ratus" + (n % 100 ? " " + convert(n % 100) : "");
        if (n < 2000) return "Seribu" + (n % 1000 ? " " + convert(n % 1000) : "");
        if (n < 1000000) return convert(Math.floor(n / 1000)) + " Ribu" + (n % 1000 ? " " + convert(n % 1000) : "");
        if (n < 1000000000) return convert(Math.floor(n / 1000000)) + " Juta" + (n % 1000000 ? " " + convert(n % 1000000) : "");
        return convert(Math.floor(n / 1000000000)) + " Milyar" + (n % 1000000000 ? " " + convert(n % 1000000000) : "");
    };
    
    return convert(num) + " Rupiah";
}

/**
 * Create batch hutang records for multiple students
 */
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

    // Use transaction for safety
    return db.transaction(async (tx) => {
        const result = await tx.insert(tabunganHutang).values(batchData).returning();
        return { success: true, count: result.length, items: result };
    });
}

// ==========================================
// Bank Statement (Rekening Koran) Functions
// ==========================================

import crypto from "crypto";

interface StatementMutation {
    date: Date;
    refId: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    category: "deposit" | "withdrawal" | "debt_settlement";
}

interface StatementResult {
    student: {
        id: string;
        nama: string;
        nisn: string;
        kelas: string | null;
    };
    period: {
        start: Date;
        end: Date;
    };
    openingBalance: number;
    mutations: StatementMutation[];
    summary: {
        totalCredit: number;
        totalDebit: number;
        closingBalance: number;
    };
    verificationHash: string;
    generatedAt: Date;
}

/**
 * Generate bank-style statement with running balance
 */
export async function getStudentStatement(
    siswaId: string,
    startDate: Date,
    endDate: Date
): Promise<StatementResult | null> {
    // 1. Get student info
    const student = await getSiswaById(siswaId);
    if (!student) return null;

    // Normalize dates
    const periodStart = new Date(startDate);
    periodStart.setHours(0, 0, 0, 0);
    
    const periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999);

    // 2. Calculate Opening Balance (all verified transactions BEFORE startDate)
    const [openingResult] = await db
        .select({
            balance: sql<number>`coalesce(sum(case when ${tabunganTransaksi.tipe} = 'setor' then ${tabunganTransaksi.nominal} else -${tabunganTransaksi.nominal} end), 0)`
        })
        .from(tabunganTransaksi)
        .where(and(
            eq(tabunganTransaksi.siswaId, siswaId),
            inArray(tabunganTransaksi.status, ["verified", "collected"]),
            sql`${tabunganTransaksi.createdAt} < ${periodStart.getTime()}`
        ));

    const openingBalance = openingResult?.balance || 0;

    // 3. Get Transactions within period
    const transactions = await db
        .select({
            id: tabunganTransaksi.id,
            tipe: tabunganTransaksi.tipe,
            nominal: tabunganTransaksi.nominal,
            catatan: tabunganTransaksi.catatan,
            status: tabunganTransaksi.status,
            createdAt: tabunganTransaksi.createdAt,
            userName: users.fullName,
        })
        .from(tabunganTransaksi)
        .leftJoin(users, eq(tabunganTransaksi.userId, users.id))
        .where(and(
            eq(tabunganTransaksi.siswaId, siswaId),
            inArray(tabunganTransaksi.status, ["verified", "collected"]),
            sql`${tabunganTransaksi.createdAt} >= ${periodStart.getTime()}`,
            sql`${tabunganTransaksi.createdAt} <= ${periodEnd.getTime()}`
        ))
        .orderBy(asc(tabunganTransaksi.createdAt));

    // 4. Get Settled Debts within period (debts paid from tabungan)
    const settledDebts = await db
        .select({
            id: tabunganHutang.id,
            namaBarang: tabunganHutang.namaBarang,
            nominal: tabunganHutang.nominal,
            jumlah: tabunganHutang.jumlah,
            tanggalLunas: tabunganHutang.tanggalLunas,
        })
        .from(tabunganHutang)
        .where(and(
            eq(tabunganHutang.siswaId, siswaId),
            eq(tabunganHutang.status, "lunas"),
            eq(tabunganHutang.dilunaskanDari, "tabungan"),
            sql`${tabunganHutang.tanggalLunas} >= ${periodStart.getTime()}`,
            sql`${tabunganHutang.tanggalLunas} <= ${periodEnd.getTime()}`
        ))
        .orderBy(asc(tabunganHutang.tanggalLunas));

    // 5. Combine and sort all mutations chronologically
    interface RawMutation {
        date: Date;
        refId: string;
        description: string;
        amount: number; // positive for credit, negative for debit
        category: "deposit" | "withdrawal" | "debt_settlement";
    }

    const rawMutations: RawMutation[] = [];

    // Add transactions
    for (const tx of transactions) {
        const dateObj = tx.createdAt ? new Date(tx.createdAt) : new Date();
        const refId = generateRefId(dateObj, tx.id);
        
        if (tx.tipe === "setor") {
            rawMutations.push({
                date: dateObj,
                refId,
                description: tx.catatan || `Setoran Tunai${tx.status === 'collected' ? ' (Menunggu Verifikasi)' : ''}${tx.userName ? ` via ${tx.userName}` : ""}`,
                amount: tx.nominal,
                category: "deposit",
            });
        } else {
            rawMutations.push({
                date: dateObj,
                refId,
                description: tx.catatan || "Penarikan Tunai",
                amount: -tx.nominal,
                category: "withdrawal",
            });
        }
    }

    // Add settled debts
    for (const debt of settledDebts) {
        const dateObj = debt.tanggalLunas ? new Date(debt.tanggalLunas) : new Date();
        const refId = generateRefId(dateObj, debt.id);
        const totalAmount = debt.nominal * debt.jumlah;
        
        rawMutations.push({
            date: dateObj,
            refId,
            description: `Debet: Pelunasan ${debt.namaBarang}`,
            amount: -totalAmount,
            category: "debt_settlement",
        });
    }

    // Sort by date
    rawMutations.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 6. Calculate Running Balance
    let currentBalance = openingBalance;
    let totalCredit = 0;
    let totalDebit = 0;

    const mutations: StatementMutation[] = rawMutations.map((m) => {
        currentBalance += m.amount;
        
        if (m.amount > 0) {
            totalCredit += m.amount;
        } else {
            totalDebit += Math.abs(m.amount);
        }

        return {
            date: m.date,
            refId: m.refId,
            description: m.description,
            credit: m.amount > 0 ? m.amount : 0,
            debit: m.amount < 0 ? Math.abs(m.amount) : 0,
            balance: currentBalance,
            category: m.category,
        };
    });

    const closingBalance = currentBalance;

    // 7. Generate Verification Hash
    const hashData = `${siswaId}:${periodStart.toISOString()}:${periodEnd.toISOString()}:${closingBalance}:${process.env.AUTH_SECRET || "sekolahku-secret"}`;
    const verificationHash = crypto
        .createHash("sha256")
        .update(hashData)
        .digest("hex")
        .substring(0, 16); // Shortened for URL friendliness

    return {
        student: {
            id: student.id,
            nama: student.nama,
            nisn: student.nisn,
            kelas: student.kelas?.nama || null,
        },
        period: {
            start: periodStart,
            end: periodEnd,
        },
        openingBalance,
        mutations,
        summary: {
            totalCredit,
            totalDebit,
            closingBalance,
        },
        verificationHash,
        generatedAt: new Date(),
    };
}

/**
 * Generate transaction reference ID in format TRX-YYMMDD-XXX
 */
function generateRefId(date: Date, id: string): string {
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, "0");
    const dd = date.getDate().toString().padStart(2, "0");
    const suffix = id.slice(-3).toUpperCase();
    return `TRX-${yy}${mm}${dd}-${suffix}`;
}

/**
 * Verify a statement hash
 */
export async function verifyStatementHash(
    hash: string,
    siswaId: string,
    startDate: Date,
    endDate: Date,
    closingBalance: number
): Promise<boolean> {
    const hashData = `${siswaId}:${startDate.toISOString()}:${endDate.toISOString()}:${closingBalance}:${process.env.AUTH_SECRET || "sekolahku-secret"}`;
    const expectedHash = crypto
        .createHash("sha256")
        .update(hashData)
        .digest("hex")
        .substring(0, 16);
    
    return hash === expectedHash;
}
