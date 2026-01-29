// ==========================================
// Tabungan (Student Savings) Module Types
// ==========================================

import { type TabunganKelas, type TabunganSiswa, type TabunganTransaksi } from "@/db/schema/tabungan";

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

// Re-export base types
export type { TabunganKelas, TabunganSiswa, TabunganTransaksi };

// ==========================================
// Enums
// ==========================================

export type TransactionType = "setor" | "tarik";
export type TransactionStatus = "pending" | "verified" | "rejected";

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
