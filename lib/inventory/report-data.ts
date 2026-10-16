/**
 * Penampung data laporan inventaris — logika murni, tanpa React dan tanpa
 * pemanggilan jaringan, supaya bisa diuji langsung.
 *
 * Dipisahkan dari halaman agar aturan pengelompokan dan penjumlahan bisa
 * diuji tanpa merender apa pun. Mengikuti pola yang sudah ada di
 * app/(dashboard)/admin/siswa/buku-induk/print/_lib/transcript.ts.
 */

import type { InventoryAsset } from "@/types/inventory";

/**
 * Ubah tanggal dari API (RFC3339, mis. "2026-04-15T00:00:00Z") menjadi tanggal
 * format dd/mm/yyyy ("15/04/2026") agar ringkas dan muat di kolom "Tanggal
 * Beli". Nilai kosong/tak valid → "-".
 *
 * Penting: tanpa ini, kolom "Tanggal Beli" menampilkan ISO mentah
 * (2026-04-15T00:00:00Z). Format dd/mm/yyyy dipilih (bukan "15 April 2026")
 * karena tanggal panjang membuat teks membungkus dua baris dan merusak tinggi
 * baris. Zona waktu diabaikan (tanggal disimpan pada tengah malam UTC) agar
 * tidak bergeser satu hari.
 */
export function formatIndonesianDate(value?: string | null): string {
    if (!value) return "-";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!m) {
        // Bukan ISO — mungkin sudah berupa teks tanggal; kembalikan apa adanya.
        return value;
    }
    const day = Number(m[3]);
    const month = Number(m[2]);
    const year = Number(m[1]);
    if (month < 1 || month > 12) return value;
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** Empat kondisi seperti yang disediakan GetConditionBreakdown. */
export const CONDITIONS = ["Baik", "Rusak Ringan", "Rusak Berat", "Hilang"] as const;
export type ConditionName = (typeof CONDITIONS)[number];

export interface AssetRow {
    id: string;
    code: string;
    name: string;
    category: string;
    roomName: string;
    /** Id ruangan (expand.room.id) untuk filter; null bila tanpa ruangan. */
    roomId: string | null;
    quantity: number;
    good: number;
    lightDamaged: number;
    heavyDamaged: number;
    lost: number;
    /** Barang yang belum dikelompokkan kondisinya: quantity - (good+light+heavy+lost). */
    unclassified: number;
    price: number;
    /** quantity * price */
    value: number;
    // Data perolehan (migrasi 000085). Dibawa ke baris laporan agar template
    // Studio Format dapat menampilkan penyedia/nota/merk bila diperlukan.
    fundingSource: string;
    fiscalYear: number | null;
    purchaseDate: string | null;
    supplier: string;
    invoiceNo: string;
    serialNumber: string;
    brand: string;
    model: string;
    acquisitionType: string;
}

export interface RoomGroup {
    roomName: string;
    rows: AssetRow[];
    totalQuantity: number;
    totalValue: number;
}

export interface ConditionTotal {
    name: ConditionName;
    count: number;
}

/**
 * Ubah aset mentah menjadi baris laporan.
 *
 * Ruangan diambil dari expand.room.name hasil join; aset tanpa ruangan
 * dikumpulkan di "Tanpa Ruangan" supaya tidak hilang dari laporan — kalau
 * dibuang, jumlah laporan tidak akan sama dengan jumlah aset.
 */
export function toAssetRows(assets: InventoryAsset[]): AssetRow[] {
    return assets.map((a) => {
        const good = a.condition_good || 0;
        const light = a.condition_light_damaged || 0;
        const heavy = a.condition_heavy_damaged || 0;
        const lost = a.condition_lost || 0;
        const quantity = a.quantity || 0;
        const price = a.price || 0;
        return {
            id: a.id,
            code: a.code || "-",
            name: a.name || "-",
            category: a.category || "-",
            roomName: a.expand?.room?.name || "Tanpa Ruangan",
            roomId: a.expand?.room?.id ?? null,
            quantity,
            good,
            lightDamaged: light,
            heavyDamaged: heavy,
            lost,
            unclassified: quantity - (good + light + heavy + lost),
            price,
            value: quantity * price,
            fundingSource: a.fundingSource || "-",
            fiscalYear: a.fiscalYear ?? null,
            purchaseDate: a.purchase_date ? formatIndonesianDate(a.purchase_date) : null,
            supplier: a.supplier || "-",
            invoiceNo: a.invoiceNo || "-",
            serialNumber: a.serialNumber || "-",
            brand: a.brand || "-",
            model: a.model || "-",
            acquisitionType: a.acquisitionType || "-",
        };
    });
}

/**
 * Kelompokkan baris per ruangan, diurutkan menurut abjad.
 * Setiap kelompok ikut membawa totalnya sendiri, sehingga laporan bisa
 * menampilkan sub-total per ruangan.
 */
export function groupByRoom(rows: AssetRow[]): RoomGroup[] {
    const map = new Map<string, AssetRow[]>();
    for (const r of rows) {
        const list = map.get(r.roomName);
        if (list) list.push(r);
        else map.set(r.roomName, [r]);
    }
    return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0], "id"))
        .map(([roomName, list]) => ({
            roomName,
            rows: list,
            totalQuantity: list.reduce((s, r) => s + r.quantity, 0),
            totalValue: list.reduce((s, r) => s + r.value, 0),
        }));
}

/**
 * Jumlahkan kondisi dari baris-baris laporan.
 *
 * Mengembalikan empat kondisi plus "Belum Diklasifikasi". Yang terakhir ini
 * penting: good+light+heavy+lost TIDAK dijamin sama dengan quantity, karena
 * keduanya tersimpan di kolom berbeda tanpa pengikat. Tanpa baris ini,
 * pembaca akan mengira angka-angka tersebut sudah mencakup seluruh barang.
 */
export function conditionTotals(rows: AssetRow[]): ConditionTotal[] {
    const good = rows.reduce((s, r) => s + r.good, 0);
    const light = rows.reduce((s, r) => s + r.lightDamaged, 0);
    const heavy = rows.reduce((s, r) => s + r.heavyDamaged, 0);
    const lost = rows.reduce((s, r) => s + r.lost, 0);
    return [
        { name: "Baik", count: good },
        { name: "Rusak Ringan", count: light },
        { name: "Rusak Berat", count: heavy },
        { name: "Hilang", count: lost },
    ];
}

/** Total baris yang belum dikelompokkan kondisinya. */
export function unclassifiedTotal(rows: AssetRow[]): number {
    return rows.reduce((s, r) => s + r.unclassified, 0);
}

/** Total keseluruhan untuk baris "Jumlah". */
export function grandTotals(rows: AssetRow[]) {
    return {
        quantity: rows.reduce((s, r) => s + r.quantity, 0),
        value: rows.reduce((s, r) => s + r.value, 0),
    };
}

/**
 * Filter laporan aset tetap: tahun anggaran, kategori, dan ruangan.
 *
 * Berbeda dengan `filterRows` (pencarian layar bebas), filter ini dipakai
 * untuk MEMBATASI ISI LAPORAN — semua output (cetak, Excel, PDF, CSV)
 * mengikuti hasilnya. Nilai "all"/kosong berarti tanpa batas.
 * Aset tanpa tahun anggaran (`fiscalYear` null) disembunyikan saat filter
 * tahun aktif, agar laporan "TA 2024" benar-benar murni TA tersebut.
 */
export interface AssetReportFilter {
    fiscalYear?: number | "all";
    category?: string;
    roomId?: string;
}

/** Nilai filter kosong = tanpa batas (semua data). */
export const EMPTY_ASSET_REPORT_FILTER: AssetReportFilter = {
    fiscalYear: "all",
    category: "all",
    roomId: "all",
};

/** True bila ada setidaknya satu filter aktif. */
export function hasActiveAssetFilter(f: AssetReportFilter): boolean {
    return (
        (f.fiscalYear !== undefined && f.fiscalYear !== "all") ||
        (f.category !== undefined && f.category !== "all" && f.category !== "") ||
        (f.roomId !== undefined && f.roomId !== "all" && f.roomId !== "")
    );
}

export function filterAssetRows(rows: AssetRow[], f: AssetReportFilter): AssetRow[] {
    return rows.filter((r) => {
        if (f.fiscalYear !== undefined && f.fiscalYear !== "all" && r.fiscalYear !== f.fiscalYear) {
            return false;
        }
        if (f.category !== undefined && f.category !== "all" && f.category !== "" && r.category !== f.category) {
            return false;
        }
        if (f.roomId !== undefined && f.roomId !== "all" && f.roomId !== "" && r.roomId !== f.roomId) {
            return false;
        }
        return true;
    });
}

/**
 * Saring baris menurut kata kunci (nama, kode, kategori, ruangan).
 *
 * Hanya dipakai di layar untuk mencari baris tertentu; hasil cetak tetap
 * memuat seluruh data. Pencarian tidak peka huruf besar-kecil dan mengabaikan
 * spasi di ujung.
 */
export function filterRows(rows: AssetRow[], query: string): AssetRow[] {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
        [r.name, r.code, r.category, r.roomName].some((f) => f.toLowerCase().includes(q))
    );
}

/**
 * Penomoran laporan: nomor urut menyeluruh lintas ruangan (1..N).
 *
 * Dulu nomor dihitung per kelompok ruangan, sehingga setiap ruangan selalu
 * mulai dari 1 dan nomornya tidak pernah mencerminkan urutan sebenarnya.
 */
export function renumber(groups: RoomGroup[]): Map<string, number> {
    const map = new Map<string, number>();
    let n = 0;
    for (const g of groups) {
        for (const r of g.rows) map.set(r.id, ++n);
    }
    return map;
}
