/**
 * Penampung data laporan inventaris — logika murni, tanpa React dan tanpa
 * pemanggilan jaringan, supaya bisa diuji langsung.
 *
 * Dipisahkan dari halaman agar aturan pengelompokan dan penjumlahan bisa
 * diuji tanpa merender apa pun. Mengikuti pola yang sudah ada di
 * app/(dashboard)/admin/siswa/buku-induk/print/_lib/transcript.ts.
 */

import type { InventoryAsset } from "@/types/inventory";

/** Empat kondisi seperti yang disediakan GetConditionBreakdown. */
export const CONDITIONS = ["Baik", "Rusak Ringan", "Rusak Berat", "Hilang"] as const;
export type ConditionName = (typeof CONDITIONS)[number];

export interface AssetRow {
    id: string;
    code: string;
    name: string;
    category: string;
    roomName: string;
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
            quantity,
            good,
            lightDamaged: light,
            heavyDamaged: heavy,
            lost,
            unclassified: quantity - (good + light + heavy + lost),
            price,
            value: quantity * price,
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
