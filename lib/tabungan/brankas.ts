// ==========================================
// Tabungan Brankas (Treasury/Ledger) Logic
// ==========================================
import "server-only";

import { db } from "@/db";
import { tabunganBrankas, tabunganBrankasTransaksi, type BrankasTransaksiTipe } from "@/db/schema/tabungan";
import { eq } from "drizzle-orm";

export async function getBrankasStats() {
    const brankas = await db.query.tabunganBrankas.findMany({
        with: {
            pic: true
        }
    });
    
    return brankas;
}

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
        const updateData: any = {
            nama: data.nama,
            updatedAt: new Date()
        };
        
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
