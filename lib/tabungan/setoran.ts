// ==========================================
// Tabungan Setoran (Settlement) Logic
// ==========================================
import "server-only";

import { db } from "@/db";
import { tabunganSiswa, tabunganTransaksi, tabunganSetoran, tabunganBrankas, tabunganBrankasTransaksi, type SetoranStatus } from "@/db/schema/tabungan";
import { eq, and, desc, sql } from "drizzle-orm";

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
        // 1. Get all open transactions for this teacher
        const openTx = tx.select().from(tabunganTransaksi).where(and(
            eq(tabunganTransaksi.userId, guruId),
            sql`${tabunganTransaksi.setoranId} IS NULL`,
            eq(tabunganTransaksi.status, "collected")
        )).all();

        if (openTx.length === 0) throw new Error("Tidak ada transaksi untuk disetor");

        // 2. Calculate Total (Net: Deposit - Withdraw)
        const deposits = openTx.filter(t => t.tipe === "setor").reduce((sum, t) => sum + t.nominal, 0);
        const withdrawals = openTx.filter(t => t.tipe === "tarik").reduce((sum, t) => sum + t.nominal, 0);
        
        const netAmount = deposits - withdrawals;
        
        let tipe: "setor_ke_bendahara" | "tarik_dari_bendahara" = "setor_ke_bendahara";
        let total = netAmount;
        
        if (netAmount < 0) {
            tipe = "tarik_dari_bendahara";
            total = Math.abs(netAmount);
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

            // 4. Update each transaction status and student saldo
            for (const txn of batchTransactions) {
                tx.update(tabunganTransaksi)
                    .set({ status: "verified", updatedAt: new Date() } as any)
                    .where(eq(tabunganTransaksi.id, txn.id))
                    .run();

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

            // 6. Record Brankas Transaction
            tx.insert(tabunganBrankasTransaksi).values({
                tipe: setoran.tipe === "setor_ke_bendahara" ? "setor_ke_koperasi" : "tarik_dari_koperasi", 
                nominal: fisik,
                userId: bendaharaId,
                catatan: `Setoran Harian verified: ${catatan || '-'}`,
                createdAt: new Date(),
            } as any).run();
        } else if (status === "rejected") {
            tx.update(tabunganTransaksi)
                .set({ status: "rejected", updatedAt: new Date() } as any)
                .where(eq(tabunganTransaksi.setoranId, setoranId))
                .run();
        }
        
        return setoran;
    });
}

export async function updateTransaksiInBatch(
    transaksiId: string,
    data: { nominal?: number; catatan?: string }
) {
    return db.transaction((tx) => {
        const txnRows = tx.select().from(tabunganTransaksi)
            .where(eq(tabunganTransaksi.id, transaksiId))
            .all();
        const txn = txnRows[0];
        if (!txn) throw new Error("Transaksi tidak ditemukan");
        if (!txn.setoranId) throw new Error("Transaksi tidak terhubung ke setoran");

        const setoranRows = tx.select().from(tabunganSetoran)
            .where(eq(tabunganSetoran.id, txn.setoranId))
            .all();
        const setoran = setoranRows[0];
        if (!setoran) throw new Error("Setoran tidak ditemukan");
        if (setoran.status !== "rejected") {
            throw new Error("Hanya dapat mengedit transaksi dalam setoran yang ditolak");
        }

        const [updatedTxn] = tx.update(tabunganTransaksi)
            .set({
                nominal: data.nominal ?? txn.nominal,
                catatan: data.catatan ?? txn.catatan,
                status: "collected",
                updatedAt: new Date()
            } as any)
            .where(eq(tabunganTransaksi.id, transaksiId))
            .returning().all();

        // Recalculate batch total
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

        tx.update(tabunganSetoran)
            .set({ totalNominal: total, tipe, updatedAt: new Date() } as any)
            .where(eq(tabunganSetoran.id, txn.setoranId))
            .run();

        return updatedTxn;
    });
}

export async function resubmitSetoran(setoranId: string, catatan?: string) {
    return db.transaction((tx) => {
        const setoranRows = tx.select().from(tabunganSetoran)
            .where(eq(tabunganSetoran.id, setoranId))
            .all();
        const setoran = setoranRows[0];
        if (!setoran) throw new Error("Setoran tidak ditemukan");
        if (setoran.status !== "rejected") {
            throw new Error("Hanya dapat mengajukan ulang setoran yang ditolak");
        }

        tx.update(tabunganTransaksi)
            .set({ status: "collected", updatedAt: new Date() } as any)
            .where(eq(tabunganTransaksi.setoranId, setoranId))
            .run();

        const [updated] = tx.update(tabunganSetoran)
            .set({ 
                status: "pending", 
                catatan: catatan ?? setoran.catatan,
                nominalFisik: null,
                selisih: 0,
                bendaharaId: null,
                updatedAt: new Date() 
            } as any)
            .where(eq(tabunganSetoran.id, setoranId))
            .returning().all();

        return updated;
    });
}

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
