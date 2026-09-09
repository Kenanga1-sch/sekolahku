import { describe, it, expect } from "vitest";
import {
    toAssetRows,
    groupByRoom,
    conditionTotals,
    unclassifiedTotal,
    grandTotals,
    filterRows,
    renumber,
} from "./report-data";
import type { InventoryAsset } from "@/types/inventory";

function asset(over: Partial<InventoryAsset> = {}): InventoryAsset {
    return {
        id: "a1",
        name: "Meja",
        code: "INV/001",
        category: "Mebel",
        price: 100000,
        quantity: 4,
        condition_good: 4,
        condition_light_damaged: 0,
        condition_heavy_damaged: 0,
        condition_lost: 0,
        status: "ACTIVE",
        ...over,
    } as InventoryAsset;
}

describe("report-data", () => {
    it("menghitung nilai baris dari quantity x price", () => {
        const [row] = toAssetRows([asset({ quantity: 3, price: 50000 })]);
        expect(row.value).toBe(150000);
    });

    it("memakai 'Tanpa Ruangan' bila aset tidak punya ruangan", () => {
        const [row] = toAssetRows([asset({ expand: undefined })]);
        expect(row.roomName).toBe("Tanpa Ruangan");
    });

    it("mengelompokkan per ruangan dan menjumlahkan sub-total", () => {
        const rows = toAssetRows([
            asset({ id: "1", quantity: 2, price: 1000, expand: { room: { id: "r1", name: "Kelas A" } } }),
            asset({ id: "2", quantity: 3, price: 2000, expand: { room: { id: "r1", name: "Kelas A" } } }),
            asset({ id: "3", quantity: 1, price: 5000, expand: { room: { id: "r2", name: "Kelas B" } } }),
        ]);
        const groups = groupByRoom(rows);

        expect(groups).toHaveLength(2);
        expect(groups[0].roomName).toBe("Kelas A");
        expect(groups[0].rows).toHaveLength(2);
        expect(groups[0].totalQuantity).toBe(5);
        expect(groups[0].totalValue).toBe(2 * 1000 + 3 * 2000);
        expect(groups[1].totalQuantity).toBe(1);
    });

    it("menyatakan selisih kondisi sebagai 'belum diklasifikasi'", () => {
        // quantity 10, tetapi kondisi hanya mencakup 6 -> 4 belum terklasifikasi.
        const rows = toAssetRows([
            asset({
                quantity: 10,
                condition_good: 5,
                condition_light_damaged: 1,
                condition_heavy_damaged: 0,
                condition_lost: 0,
            }),
        ]);
        expect(rows[0].unclassified).toBe(4);
        expect(unclassifiedTotal(rows)).toBe(4);
    });

    it("memisahkan rusak ringan dan rusak berat (empat kondisi)", () => {
        const rows = toAssetRows([
            asset({
                quantity: 5,
                condition_good: 2,
                condition_light_damaged: 1,
                condition_heavy_damaged: 1,
                condition_lost: 1,
            }),
        ]);
        const totals = conditionTotals(rows);
        expect(totals).toEqual([
            { name: "Baik", count: 2 },
            { name: "Rusak Ringan", count: 1 },
            { name: "Rusak Berat", count: 1 },
            { name: "Hilang", count: 1 },
        ]);
    });

    it("menjumlahkan total akhir dengan benar", () => {
        const rows = toAssetRows([
            asset({ id: "1", quantity: 2, price: 1000 }),
            asset({ id: "2", quantity: 3, price: 2000 }),
        ]);
        const t = grandTotals(rows);
        expect(t.quantity).toBe(5);
        expect(t.value).toBe(8000);
    });

    it("tidak kehilangan aset saat dikelompokkan", () => {
        const rows = toAssetRows([asset({ id: "1" }), asset({ id: "2", expand: undefined }), asset({ id: "3" })]);
        const grouped = groupByRoom(rows);
        const count = grouped.reduce((s, g) => s + g.rows.length, 0);
        expect(count).toBe(rows.length);
    });

    it("menomori urut menyeluruh lintas ruangan, bukan ulang dari 1", () => {
        const rows = toAssetRows([
            asset({ id: "1", expand: { room: { id: "r1", name: "Kelas A" } } }),
            asset({ id: "2", expand: { room: { id: "r1", name: "Kelas A" } } }),
            asset({ id: "3", expand: { room: { id: "r2", name: "Kelas B" } } }),
        ]);
        const map = renumber(groupByRoom(rows));
        expect(map.get("1")).toBe(1);
        expect(map.get("2")).toBe(2);
        // Dulu nomor dihitung per ruangan, jadi baris ini kembali ke 1.
        expect(map.get("3")).toBe(3);
    });

    it("menyaring baris menurut nama, kode, kategori, atau ruangan", () => {
        const rows = toAssetRows([
            asset({ id: "1", name: "Meja Guru", code: "MEJ-01", category: "Mebel" }),
            asset({ id: "2", name: "Kursi", code: "KUR-01", category: "Mebel" }),
        ]);
        expect(filterRows(rows, "meja").map((r) => r.id)).toEqual(["1"]);
        expect(filterRows(rows, "KUR-01").map((r) => r.id)).toEqual(["2"]);
        expect(filterRows(rows, "  ").map((r) => r.id)).toEqual(["1", "2"]);
        expect(filterRows(rows, "zzz")).toEqual([]);
    });
});
