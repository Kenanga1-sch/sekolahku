// ==========================================
// Tabungan (Student Savings) Module Types
// ==========================================

// Base type for PocketBase records
interface BaseRecord {
    id: string;
    created: string;
    updated: string;
}

// ==========================================
// Kelas (Class)
// ==========================================

export interface TabunganKelas extends BaseRecord {
    nama: string;
    wali_kelas?: string;
    // Expanded relations
    expand?: {
        wali_kelas?: TabunganUser;
    };
}

// ==========================================
// Siswa (Student)
// ==========================================

export interface TabunganSiswa extends BaseRecord {
    nisn: string;
    nama: string;
    kelas_id: string;
    saldo_terakhir: number;
    qr_code: string;
    foto?: string;
    is_active: boolean;
    // Expanded relations
    expand?: {
        kelas_id?: TabunganKelas;
    };
}

// ==========================================
// Transaksi (Transaction)
// ==========================================

export type TransactionType = "setor" | "tarik";
export type TransactionStatus = "pending" | "verified" | "rejected";

export interface TabunganTransaksi extends BaseRecord {
    siswa_id: string;
    user_id: string;
    tipe: TransactionType;
    nominal: number;
    status: TransactionStatus;
    catatan?: string;
    verified_by?: string;
    verified_at?: string;
    // Expanded relations
    expand?: {
        siswa_id?: TabunganSiswa;
        user_id?: TabunganUser;
        verified_by?: TabunganUser;
    };
}

// ==========================================
// User (for relation expansion)
// ==========================================

export interface TabunganUser {
    id: string;
    email: string;
    name: string;
    role: string;
}

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

export interface TabunganSiswaFormData {
    nisn: string;
    nama: string;
    kelas_id: string;
}

export interface TabunganKelasFormData {
    nama: string;
    wali_kelas?: string;
}

export interface TabunganTransaksiFormData {
    siswa_id: string;
    tipe: TransactionType;
    nominal: number;
    catatan?: string;
}
