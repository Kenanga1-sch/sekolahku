// ==========================================
// Tabungan Statistics & Charts
// ==========================================
import "server-only";

import { db } from "@/db";
import { tabunganKelas, tabunganSiswa, tabunganTransaksi } from "@/db/schema/tabungan";
import { users } from "@/db/schema/users";
import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";
import type {
    TabunganStats,
    TabunganSiswaWithRelations,
} from "@/types/tabungan";

export async function getTabunganStats(): Promise<TabunganStats> {
    try {
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
            db.select({ count: sql<number>`count(*)` }).from(tabunganSiswa).where(eq(tabunganSiswa.isActive, true)),
            db.select({ sum: sql<number>`sum(${tabunganSiswa.saldoTerakhir})` }).from(tabunganSiswa).where(eq(tabunganSiswa.isActive, true)),
            db.select({ count: sql<number>`count(*)` }).from(tabunganTransaksi).where(eq(tabunganTransaksi.status, "pending")),
            db.select({ count: sql<number>`count(*)` }).from(tabunganTransaksi).where(and(
                gte(tabunganTransaksi.createdAt, startOfDay),
                lte(tabunganTransaksi.createdAt, endOfDay)
            )),
            db.select({ sum: sql<number>`sum(${tabunganTransaksi.nominal})` }).from(tabunganTransaksi).where(and(
                gte(tabunganTransaksi.createdAt, startOfDay),
                lte(tabunganTransaksi.createdAt, endOfDay),
                eq(tabunganTransaksi.tipe, "setor"),
                eq(tabunganTransaksi.status, "verified")
            )),
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
    
    const colors = [
        "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", 
        "#ec4899", "#14b8a6", "#6366f1", "#84cc16", "#06b6d4"
    ];

    return rows.map((row, index) => {
        let displayName = row.kelasNama || "Tanpa Kelas";
        if (row.waliKelasNama) {
            displayName += ` (${row.waliKelasNama})`;
        }
        
        return {
            name: displayName,
            value: row.totalSaldo || 0,
            color: colors[index % colors.length]
        };
    });
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
