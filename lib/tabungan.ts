// ==========================================
// Tabungan (Student Savings) Helper Functions
// ==========================================

import { getPocketBase } from "./pocketbase";
import { sanitizeFilter, sanitizeId } from "./security";
import type {
    TabunganKelas,
    TabunganSiswa,
    TabunganTransaksi,
    TabunganStats,
    TabunganSiswaFormData,
    TabunganKelasFormData,
    TabunganTransaksiFormData,
    TransactionStatus,
} from "@/types/tabungan";

const pb = getPocketBase();

// ==========================================
// Collection Accessors
// ==========================================

const tabunganCollections = {
    kelas: () => pb.collection("tabungan_kelas"),
    siswa: () => pb.collection("tabungan_siswa"),
    transaksi: () => pb.collection("tabungan_transaksi"),
};

// ==========================================
// Kelas CRUD
// ==========================================

export async function getKelas(page = 1, perPage = 20) {
    return await tabunganCollections.kelas().getList<TabunganKelas>(page, perPage, {
        sort: "nama",
        expand: "wali_kelas",
    });
}

export async function getAllKelas() {
    return await tabunganCollections.kelas().getFullList<TabunganKelas>({
        sort: "nama",
    });
}

export async function createKelas(data: TabunganKelasFormData) {
    return await tabunganCollections.kelas().create<TabunganKelas>(data);
}

export async function updateKelas(id: string, data: Partial<TabunganKelasFormData>) {
    const safeId = sanitizeId(id);
    return await tabunganCollections.kelas().update<TabunganKelas>(safeId, data);
}

export async function deleteKelas(id: string) {
    const safeId = sanitizeId(id);
    return await tabunganCollections.kelas().delete(safeId);
}

// ==========================================
// Siswa CRUD
// ==========================================

export async function getSiswa(page = 1, perPage = 20, filter = "") {
    return await tabunganCollections.siswa().getList<TabunganSiswa>(page, perPage, {
        filter,
        sort: "nama",
        expand: "kelas_id",
    });
}

export async function getSiswaByQRCode(qrCode: string): Promise<TabunganSiswa | null> {
    try {
        const safeQR = sanitizeFilter(qrCode);
        return await tabunganCollections.siswa().getFirstListItem<TabunganSiswa>(
            `qr_code = "${safeQR}" && is_active = true`,
            { expand: "kelas_id" }
        );
    } catch {
        return null;
    }
}

export async function getSiswaByNISN(nisn: string): Promise<TabunganSiswa | null> {
    try {
        const safeNISN = sanitizeFilter(nisn);
        return await tabunganCollections.siswa().getFirstListItem<TabunganSiswa>(
            `nisn = "${safeNISN}"`,
            { expand: "kelas_id" }
        );
    } catch {
        return null;
    }
}

export async function createSiswa(data: TabunganSiswaFormData) {
    const qrCode = `STU-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    return await tabunganCollections.siswa().create<TabunganSiswa>({
        ...data,
        qr_code: qrCode,
        saldo_terakhir: 0,
        is_active: true,
    });
}

export async function updateSiswa(id: string, data: Partial<TabunganSiswa>) {
    const safeId = sanitizeId(id);
    return await tabunganCollections.siswa().update<TabunganSiswa>(safeId, data);
}

export async function deleteSiswa(id: string) {
    const safeId = sanitizeId(id);
    // Soft delete - mark as inactive
    return await tabunganCollections.siswa().update<TabunganSiswa>(safeId, {
        is_active: false,
    });
}

// ==========================================
// Transaksi CRUD
// ==========================================

export async function getTransaksi(page = 1, perPage = 20, filter = "") {
    return await tabunganCollections.transaksi().getList<TabunganTransaksi>(page, perPage, {
        filter,
        sort: "-created",
        expand: "siswa_id,user_id,verified_by",
    });
}

export async function getPendingTransaksi() {
    return await tabunganCollections.transaksi().getList<TabunganTransaksi>(1, 100, {
        filter: 'status = "pending"',
        sort: "-created",
        expand: "siswa_id,user_id",
    });
}

export async function createTransaksi(
    data: TabunganTransaksiFormData,
    userId: string
): Promise<TabunganTransaksi> {
    // Create the transaction as pending
    const transaksi = await tabunganCollections.transaksi().create<TabunganTransaksi>({
        ...data,
        user_id: userId,
        status: "pending",
    });

    return transaksi;
}

export async function verifyTransaksi(
    id: string,
    verifierId: string,
    approve: boolean
): Promise<TabunganTransaksi> {
    const safeId = sanitizeId(id);
    const newStatus: TransactionStatus = approve ? "verified" : "rejected";

    // Get the transaction first
    const transaksi = await tabunganCollections.transaksi().getOne<TabunganTransaksi>(safeId, {
        expand: "siswa_id",
    });

    // Update transaction status
    const updated = await tabunganCollections.transaksi().update<TabunganTransaksi>(safeId, {
        status: newStatus,
        verified_by: verifierId,
        verified_at: new Date().toISOString(),
    });

    // If approved, update student balance
    if (approve && transaksi.expand?.siswa_id) {
        const siswa = transaksi.expand.siswa_id;
        const newBalance =
            transaksi.tipe === "setor"
                ? siswa.saldo_terakhir + transaksi.nominal
                : siswa.saldo_terakhir - transaksi.nominal;

        await updateSiswa(siswa.id, { saldo_terakhir: Math.max(0, newBalance) });
    }

    return updated;
}

// ==========================================
// Statistics
// ==========================================

export async function getTabunganStats(): Promise<TabunganStats> {
    const today = new Date().toISOString().split("T")[0];

    const [siswaRes, transaksiPendingRes, transaksiTodayRes] = await Promise.all([
        tabunganCollections.siswa().getList(1, 1, { filter: "is_active = true" }),
        tabunganCollections.transaksi().getList(1, 1, { filter: 'status = "pending"' }),
        tabunganCollections.transaksi().getList(1, 100, {
            filter: `created >= "${today}" && status = "verified"`,
        }),
    ]);

    // Calculate total saldo (batched for performance)
    let totalSaldo = 0;
    let page = 1;
    const batchSize = 100;
    let hasMore = true;

    while (hasMore && page <= 10) {
        const batch = await tabunganCollections.siswa().getList<TabunganSiswa>(page, batchSize, {
            filter: "is_active = true",
            fields: "saldo_terakhir",
        });

        totalSaldo += batch.items.reduce((sum, s) => sum + (s.saldo_terakhir || 0), 0);
        hasMore = batch.items.length === batchSize;
        page++;
    }

    // Calculate today's deposit and withdrawal
    let todayDeposit = 0;
    let todayWithdraw = 0;

    for (const t of transaksiTodayRes.items) {
        if (t.tipe === "setor") {
            todayDeposit += t.nominal;
        } else {
            todayWithdraw += t.nominal;
        }
    }

    return {
        totalSiswa: siswaRes.totalItems,
        totalSaldo,
        pendingTransactions: transaksiPendingRes.totalItems,
        todayTransactions: transaksiTodayRes.totalItems,
        todayDeposit,
        todayWithdraw,
    };
}

// ==========================================
// Reporting
// ==========================================

export async function getTransaksiByDateRange(startDate: string, endDate: string) {
    return await tabunganCollections.transaksi().getFullList<TabunganTransaksi>({
        filter: `created >= "${startDate}" && created <= "${endDate}" && status = "verified"`,
        sort: "-created",
        expand: "siswa_id,user_id",
    });
}

export async function getSiswaWithBalance(kelasId?: string) {
    let filter = "is_active = true";
    if (kelasId) {
        const safeKelasId = sanitizeId(kelasId);
        filter += ` && kelas_id = "${safeKelasId}"`;
    }

    return await tabunganCollections.siswa().getFullList<TabunganSiswa>({
        filter,
        sort: "nama",
        expand: "kelas_id",
    });
}
