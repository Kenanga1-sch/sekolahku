import { describe, expect, it } from "vitest";
import {
    fillAtkWorksheet,
    atkRowValues,
    atkScalarMap,
    isAtkRowVariable,
    shiftAtkFormulaRows,
    substituteAtk,
    substituteAtkCell,
    unknownAtkVariables,
    type AtkExcelInput,
    type AtkExcelRow,
} from "./inventory-atk-excel";

type Cell = { value: unknown };
type Row = {
    getCell(c: number): Cell;
    eachCell(o: { includeEmpty?: boolean }, cb: (cell: Cell, col: number) => void): void;
};
type Sheet = {
    rowCount: number;
    getRow(n: number): Row;
    eachRow(cb: (row: Row, n: number) => void): void;
    duplicateRow(n: number, count: number, insert: boolean): void;
    model?: { merges?: readonly string[] };
    unMergeCells?(range: string): void;
    mergeCells?(range: string): void;
};

function fakeSheet(cells: Record<string, unknown>, merges: string[] = []): Sheet {
    const grid = new Map<string, Cell>();
    for (const [k, v] of Object.entries(cells)) grid.set(k, { value: v });
    const liveMerges = new Set(merges);
    type FakeSheet = Sheet & {
        mergedCalls: string[];
        unmergedCalls: string[];
    };
    const api: FakeSheet = {
        rowCount: 10,
        getRow(n: number): Row {
            const rowApi: Row = {
                getCell(c: number) {
                    const key = `${n},${c}`;
                    if (!grid.has(key)) grid.set(key, { value: null });
                    return grid.get(key)!;
                },
                eachCell(_o, cb) {
                    for (let c = 1; c <= 20; c++) cb(rowApi.getCell(c), c);
                },
            };
            return rowApi;
        },
        eachRow(cb) {
            for (let n = 1; n <= 10; n++) cb(api.getRow(n), n);
        },
        duplicateRow() {},
        get model() {
            return { merges: [...liveMerges] };
        },
        mergedCalls: [],
        unmergedCalls: [],
    };
    api.unMergeCells = (range: string) => {
        liveMerges.delete(range);
        api.unmergedCalls.push(range);
    };
    api.mergeCells = (range: string) => {
        liveMerges.add(range);
        api.mergedCalls.push(range);
    };
    return api;
}

function input(rows: AtkExcelRow[]): AtkExcelInput {
    return {
        rows,
        scalars: {
            sekolahNama: "SDN 1 Kenanga",
            periode: "Posisi per 16 Oktober 2026",
            totalJenis: rows.length,
            totalNilai: 1_375_000,
        },
    };
}

const row1: AtkExcelRow = {
    code: "ATK-2026-01",
    name: "Kertas HVS A4",
    category: "Alat Tulis",
    unit: "Rim",
    currentStock: 25,
    minStock: 10,
    price: 55_000,
    nilai: 1_375_000,
};

describe("substituteAtk", () => {
    it("mengganti variabel dikenal, membiarkan yang asing", () => {
        expect(substituteAtk("{{kode}} {{nama}} {{typo}}", { kode: "ATK-1", nama: "Kertas" })).toBe(
            "ATK-1 Kertas {{typo}}"
        );
    });
});

describe("substituteAtkCell", () => {
    it("mengubah sel numerik murni menjadi NUMBER", () => {
        expect(substituteAtkCell("{{stok}}", { stok: 25 })).toBe(25);
        expect(substituteAtkCell("{{harga}}", { harga: 55_000 })).toBe(55_000);
        expect(substituteAtkCell(" {{total_nilai}} ", { total_nilai: "1375000" })).toBe(1375000);
    });

    it("tetap string untuk sel non-numerik", () => {
        expect(substituteAtkCell("{{nama}}", { nama: "Kertas HVS A4" })).toBe("Kertas HVS A4");
    });
});

describe("isAtkRowVariable", () => {
    it("mengenali variabel baris dan menolak skalar", () => {
        expect(isAtkRowVariable("{{nama}}")).toBe(true);
        expect(isAtkRowVariable("{{stok}}")).toBe(true);
        expect(isAtkRowVariable("{{sekolah_nama}}")).toBe(false);
        expect(isAtkRowVariable("teks biasa")).toBe(false);
    });
});

describe("unknownAtkVariables", () => {
    it("mendeteksi variabel di luar kamus", () => {
        expect(unknownAtkVariables(["{{nama}} {{stok}} {{salah}}"])).toEqual(["salah"]);
    });
});

describe("shiftAtkFormulaRows", () => {
    it("menggeser referensi baris contoh", () => {
        expect(shiftAtkFormulaRows("SUM(H8:H8)", 8, 2)).toBe("SUM(H10:H10)");
        expect(shiftAtkFormulaRows("SUM(H$8:H8)", 8, 1)).toBe("SUM(H$8:H9)");
    });
});

describe("atkRowValues", () => {
    it("memetakan baris ATK ke token kamus", () => {
        const v = atkRowValues(row1, 1);
        expect(v.no).toBe(1);
        expect(v.kode).toBe("ATK-2026-01");
        expect(v.nama).toBe("Kertas HVS A4");
        expect(v.satuan).toBe("Rim");
        expect(v.stok).toBe(25);
        expect(v.stok_minimum).toBe(10);
        expect(v.harga).toBe(55_000);
        expect(v.nilai).toBe(1_375_000);
    });
});

describe("atkScalarMap", () => {
    it("mengosongkan nilai undefined, bukan mencetak undefined", () => {
        const m = atkScalarMap({ rows: [], scalars: { sekolahNama: "SDN 1" } });
        expect(m.sekolah_nama).toBe("SDN 1");
        expect(m.sekolah_alamat).toBe("");
        expect(m.periode).toBe("");
    });
});

describe("fillAtkWorksheet", () => {
    const tpl = {
        "1,1": "LAPORAN STOK HABIS PAKAI {{sekolah_nama}}",
        "2,1": "{{periode}}",
        "3,1": "{{no}}",
        "3,2": "{{kode}}",
        "3,3": "{{nama}}",
        "3,4": "{{satuan}}",
        "3,5": "{{stok}}",
        "3,6": "{{harga}}",
        "3,7": "{{nilai}}",
        "3,8": "=SUM(H3:H3)",
    };

    it("mengisi skalar dan baris contoh per barang", async () => {
        const ws = fakeSheet(tpl);
        const rows: AtkExcelRow[] = [
            row1,
            { ...row1, code: "ATK-2026-02", name: "Pulpen", currentStock: 10, price: 3_000, nilai: 30_000 },
        ];
        const { rowCount, unknown } = await fillAtkWorksheet(ws as never, input(rows));
        expect(rowCount).toBe(2);
        expect(unknown).toEqual([]);
        expect(ws.getRow(1).getCell(1).value).toBe("LAPORAN STOK HABIS PAKAI SDN 1 Kenanga");
        expect(ws.getRow(3).getCell(1).value).toBe(1);
        expect(ws.getRow(3).getCell(3).value).toBe("Kertas HVS A4");
        expect(ws.getRow(3).getCell(7).value).toBe(1_375_000);
    });

    it("melaporkan baris 0 bila tidak ada baris contoh", async () => {
        const ws = fakeSheet({ "1,1": "{{sekolah_nama}}" });
        const { rowCount } = await fillAtkWorksheet(ws as never, input([row1]));
        expect(rowCount).toBe(0);
    });

    it("menandai variabel tak dikenal", async () => {
        const ws = fakeSheet({ "1,1": "{{sekolah_nama}}", "2,1": "{{nama}}", "2,2": "{{typo}}" });
        const { unknown } = await fillAtkWorksheet(ws as never, input([row1]));
        expect(unknown).toContain("typo");
    });

    it("melepas merge di bawah baris contoh lalu memasangnya kembali tergeser", async () => {
        const ws = fakeSheet(tpl, ["A5:C5"]);
        const rows: AtkExcelRow[] = [row1, row1, row1];
        await fillAtkWorksheet(ws as never, input(rows));
        const fake = ws as never as { unmergedCalls: string[]; mergedCalls: string[] };
        expect(fake.unmergedCalls).toContain("A5:C5");
        expect(fake.mergedCalls).toContain("A7:C7");
    });

    it("mengisi baris Jumlah hanya bila template menyediakannya", async () => {
        const ws = fakeSheet({ ...tpl, "4,1": "Jumlah" });
        const { rowCount } = await fillAtkWorksheet(ws as never, input([row1]));
        expect(rowCount).toBe(1);
        const c7 = ws.getRow(4).getCell(7).value as { formula?: string; result?: number };
        expect(c7.formula).toBe("SUM(G3:G3)");
        expect(c7.result).toBe(1_375_000);
    });
});