// ==========================================
// Tabungan Reports & Bank Statements
// ==========================================
import "server-only";
import crypto from "crypto";

import { db } from "@/db";
import { tabunganKelas, tabunganSiswa, tabunganTransaksi, tabunganHutang } from "@/db/schema/tabungan";
import { users } from "@/db/schema/users";
import { eq, and, asc, gte, lte, lt, inArray } from "drizzle-orm";
import { getHutangBySiswa } from "./hutang";
import { getSiswaById } from "./siswa";

// ==========================================
// Student Final Report (End of Year)
// ==========================================

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

export async function getStudentFinalReport(siswaId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();
    const periodStart = new Date(targetYear, 0, 1);
    const periodEnd = new Date(targetYear, 11, 31, 23, 59, 59);

    const siswa = await db.query.tabunganSiswa.findFirst({
        where: eq(tabunganSiswa.id, siswaId),
        with: { kelas: true },
    });
    if (!siswa) throw new Error("Siswa tidak ditemukan");

    const allTransactions = await db
        .select()
        .from(tabunganTransaksi)
        .where(and(
            eq(tabunganTransaksi.siswaId, siswaId),
            eq(tabunganTransaksi.status, "verified")
        ))
        .orderBy(asc(tabunganTransaksi.createdAt));

    let openingBalance = 0;
    const periodTransactions: typeof allTransactions = [];
    
    for (const tx of allTransactions) {
        const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date();
        if (txDate < periodStart) {
            openingBalance += tx.tipe === "setor" ? tx.nominal : -tx.nominal;
        } else if (txDate <= periodEnd) {
            periodTransactions.push(tx);
        }
    }

    const monthlySummary: { [key: string]: { setor: number; tarik: number; saldo: number } } = {};
    let totalSetor = 0;
    let totalTarik = 0;
    let runningBalance = openingBalance;

    for (const tx of periodTransactions) {
        const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlySummary[monthKey]) {
            monthlySummary[monthKey] = { setor: 0, tarik: 0, saldo: 0 };
        }
        
        if (tx.tipe === "setor") {
            monthlySummary[monthKey].setor += tx.nominal;
            totalSetor += tx.nominal;
            runningBalance += tx.nominal;
        } else {
            monthlySummary[monthKey].tarik += tx.nominal;
            totalTarik += tx.nominal;
            runningBalance -= tx.nominal;
        }
        monthlySummary[monthKey].saldo = runningBalance;
    }

    const sortedMonths = Object.keys(monthlySummary).sort();
    let prevSaldo = openingBalance;
    for (const month of sortedMonths) {
        const data = monthlySummary[month];
        prevSaldo = prevSaldo + data.setor - data.tarik;
        data.saldo = prevSaldo;
    }

    const closingBalance = openingBalance + totalSetor - totalTarik;

    const allDebts = await getHutangBySiswa(siswaId);
    const activeDebts = allDebts.filter(d => d.status === "aktif");
    const totalDebt = activeDebts.reduce((sum, d) => sum + (d.nominal * d.jumlah), 0);
    const netBalance = closingBalance - totalDebt;

    return {
        period: {
            year: targetYear,
            startDate: periodStart,
            endDate: periodEnd,
        },
        siswa: {
            id: siswa.id,
            nama: siswa.nama,
            nisn: siswa.nisn,
            kelas: siswa.kelas?.nama || "-",
        },
        tabungan: {
            openingBalance,
            monthlySummary,
            totalSetor,
            totalTarik,
            saldoAkhir: closingBalance,
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

// ==========================================
// Bank Statement (Rekening Koran)
// ==========================================

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

function generateRefId(date: Date, id: string): string {
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, "0");
    const dd = date.getDate().toString().padStart(2, "0");
    const suffix = id.slice(-3).toUpperCase();
    return `TRX-${yy}${mm}${dd}-${suffix}`;
}

import { sql } from "drizzle-orm";

export async function getStudentStatement(
    siswaId: string,
    startDate: Date,
    endDate: Date
): Promise<StatementResult | null> {
    const student = await getSiswaById(siswaId);
    if (!student) return null;

    const periodStart = new Date(startDate);
    periodStart.setHours(0, 0, 0, 0);
    
    const periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999);

    const [openingResult] = await db
        .select({
            balance: sql<number>`coalesce(sum(case when ${tabunganTransaksi.tipe} = 'setor' then ${tabunganTransaksi.nominal} else -${tabunganTransaksi.nominal} end), 0)`
        })
        .from(tabunganTransaksi)
        .where(and(
            eq(tabunganTransaksi.siswaId, siswaId),
            inArray(tabunganTransaksi.status, ["verified", "collected"]),
            lt(tabunganTransaksi.createdAt, periodStart)
        ));

    const openingBalance = openingResult?.balance || 0;

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
            gte(tabunganTransaksi.createdAt, periodStart),
            lte(tabunganTransaksi.createdAt, periodEnd)
        ))
        .orderBy(asc(tabunganTransaksi.createdAt));

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
            gte(tabunganHutang.tanggalLunas, periodStart),
            lte(tabunganHutang.tanggalLunas, periodEnd)
        ))
        .orderBy(asc(tabunganHutang.tanggalLunas));

    interface RawMutation {
        date: Date;
        refId: string;
        description: string;
        amount: number;
        category: "deposit" | "withdrawal" | "debt_settlement";
    }

    const rawMutations: RawMutation[] = [];

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

    rawMutations.sort((a, b) => a.date.getTime() - b.date.getTime());

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

    const hashData = `${siswaId}:${periodStart.toISOString()}:${periodEnd.toISOString()}:${closingBalance}:${process.env.AUTH_SECRET || "sekolahku-secret"}`;
    const verificationHash = crypto
        .createHash("sha256")
        .update(hashData)
        .digest("hex")
        .substring(0, 16);

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
