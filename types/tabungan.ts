// ==========================================
// Tabungan (Student Savings) Module Types
// ==========================================


// ==========================================
// Base Types
// ==========================================

export interface TabunganKelas {
    id: string;
    nama: string;
    waliKelas?: string;
    createdAt?: number;
    updatedAt?: number;
}

export interface TabunganSiswa {
    id: string;
    nisn?: string;
    nama: string;
    kelasId?: string;
    qrCode?: string;
    saldoTerakhir?: number;
    createdAt?: number;
    updatedAt?: number;
}

export interface TabunganTransaksi {
    id: string;
    siswaId: string;
    tipe: "setor" | "tarik";
    type?: "setor" | "tarik";
    nominal: number;
    status: "pending" | "collected" | "verified" | "rejected";
    catatan?: string;
    userId?: string;
    createdAt?: number;
    updatedAt?: number;
}

export interface TabunganSetoran {
    id: string;
    guruId?: string;
    bendaharaId?: string;
    jumlah?: number;
    amount?: number;
    status: "pending" | "verified" | "rejected";
    date?: string;
    catatan?: string;
    createdAt?: number;
    updatedAt?: number;
}

// ==========================================
// Extended Types with Relations
// ==========================================

export interface TabunganKelasWithRelations extends TabunganKelas {
    waliKelasUser?: {
        name: string;
        email: string;
    } | null;
}

export interface TabunganSiswaWithRelations extends TabunganSiswa {
    kelas?: TabunganKelas | null;
}

export interface TabunganTransaksiWithRelations extends TabunganTransaksi {
    siswa?: TabunganSiswaWithRelations | null;
    user?: {
        name: string;
        email: string;
    } | null;
    verifier?: {
        name: string;
        email: string;
    } | null;
}

export interface TabunganSetoranWithRelations extends TabunganSetoran {
    guru?: {
        name: string;
        email: string;
    } | null;
    bendahara?: {
        name: string;
        email: string;
    } | null;
    transaksi?: TabunganTransaksi[];
    totalNominal?: number;
    selisih?: number;
}

// Base types are already exported above

// ==========================================
// Enums
// ==========================================

export type TransactionType = "setor" | "tarik";
export type TransactionStatus = "pending" | "collected" | "verified" | "rejected";

// ==========================================
// Statistics
// ==========================================

export interface TabunganStats {
    totalSiswa: number;
    totalSaldo: number;
    pendingTransactions: number;
    todayTransactions: number;
    todayDeposit: number;
    todayWithdraw: number;
}

// ==========================================
// Form Data
// ==========================================

// ==========================================
// Form Data (Derived from Zod Schemas)
// ==========================================

import { 
  createSiswaSchema, 
  createKelasSchema, 
  createTransaksiSchema 
} from "@/lib/validations/tabungan";
import { z } from "zod";

export type TabunganSiswaFormData = z.infer<typeof createSiswaSchema>;
export type TabunganKelasFormData = z.infer<typeof createKelasSchema>;
export type TabunganTransaksiFormData = z.infer<typeof createTransaksiSchema>;
