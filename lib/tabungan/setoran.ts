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
    const response = await fetch("http://localhost:8080/api/savings/setoran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guruId, catatan })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Gagal membuat setoran via Go API");
    }
    
    return await response.json();
}

export async function verifySetoran(
    setoranId: string,
    status: "verified" | "rejected",
    bendaharaId: string,
    nominalFisik?: number,
    catatan?: string
) {
    const response = await fetch("http://localhost:8080/api/savings/setoran/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            setoranId,
            bendaharaId,
            status,
            nominalFisik,
            catatan
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Gagal memverifikasi setoran via Go API");
    }
    
    return await response.json();
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
