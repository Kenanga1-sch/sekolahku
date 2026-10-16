import { describe, expect, it } from "vitest";
import {
    fillTabunganWorksheet,
    tabunganRowValues,
    tabunganScalarMap,
    isTabunganRowVariable,
    shiftTabunganFormulaRows,
    substituteTabungan,
    substituteTabunganCell,
    unknownTabunganVariables,
    type TabunganExcelInput,
    type TabunganExcelRow,
} from "./tabungan-excel";

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
        duplicatedFrom?: number;
        duplicateCount?: number;
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
        duplicateRow(n: number, count: number) {
            api.duplicatedFrom = n;
            api.duplicateCount = count;
        },
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

function input(rows: TabunganExcelRow[]): TabunganExcelInput {
    return {
        rows,
        scalars: {
            sekolahNama: "SDN 1 Kenanga",
            periode: "Bulan Ini",
            totalSetoran: 3000000,
            jumlahTransaksi: rows.length,
        },
    };
}

describe("substituteTabungan", () => {
    it("mengganti variabel dikenal, membiarkan yang asing", () => {
        expect(substituteTabungan("{{tanggal}} {{siswa}} {{typo}}", { tanggal: "16/10/2026", siswa: "Budi" })).toBe(
            "16/10/2026 Budi {{typo}}"
        );
    });
});

describe("substituteTabunganCell", () => {
    it("mengubah sel bernilai numerik murni menjadi NUMBER agar format angka berlaku", () => {
        expect(substituteTabunganCell("{{nominal}}", { nominal: 50_000 })).toBe(50_000);
        expect(substituteTabunganCell("{{no}}", { no: 3 })).toBe(3);
        expect(substituteTabunganCell("{{total_setoran}}", { total_setoran: 3_000_000 })).toBe(3_000_000);
        expect(substituteTabunganCell(" {{nominal}} ", { nominal: "50000" })).toBe(50000);
    });

    it("tetap string untuk sel bertoken non-numerik", () => {
        expect(substituteTabunganCell("{{siswa}}", { siswa: "Budi Santoso" })).toBe("Budi Santoso");
        expect(substituteTabunganCell("{{status}}", { status: "verified" })).toBe("verified");
    });
});

describe("isTabunganRowVariable", () => {
    it("mengenali variabel baris dan menolak skalar", () => {
        expect(isTabunganRowVariable("{{no}}")).toBe(true);
        expect(isTabunganRowVariable("{{nominal}}")).toBe(true);
        expect(isTabunganRowVariable("{{sekolah_nama}}")).toBe(false);
        expect(isTabunganRowVariable("teks biasa")).toBe(false);
    });
});

describe("unknownTabunganVariables", () => {
    it("mendeteksi variabel di luar daftar dikenal", () => {
        expect(unknownTabunganVariables(["{{siswa}} {{nominal}} {{salah}}"])).toEqual(["salah"]);
    });
});

describe("shiftTabunganFormulaRows", () => {
    it("menggeser referensi baris contoh, lalu baris lain tidak disentuh", () => {
        expect(shiftTabunganFormulaRows("SUM(F8:F8)", 8, 2)).toBe("SUM(F10:F10)");
        expect(shiftTabunganFormulaRows("SUM(F8:F9)", 8, 1)).toBe("SUM(F9:F9)");
        expect(shiftTabunganFormulaRows("SUM(F$8:F8)", 8, 1)).toBe("SUM(F$8:F9)");
    });
});

describe("tabunganRowValues", () => {
    it("memetakan TabunganExcelRow ke token kamus", () => {
        const r: TabunganExcelRow = {
            tanggal: "16/10/2026",
            siswa: "Budi Santoso",
            kelas: "Kelas 1",
            tipe: "Setor",
            nominal: 50_000,
            status: "verified",
            petugas: "Siti",
        };
        const v = tabunganRowValues(r, 1);
        expect(v.no).toBe(1);
        expect(v.siswa).toBe("Budi Santoso");
        expect(v.kelas).toBe("Kelas 1");
        expect(v.tipe).toBe("Setor");
        expect(v.nominal).toBe(50_000);
        expect(v.status).toBe("verified");
        expect(v.petugas).toBe("Siti");
    });
});

describe("tabunganScalarMap", () => {
    it("mengosongkan nilai undefined, bukan mencetak undefined", () => {
        const m = tabunganScalarMap({ rows: [], scalars: { sekolahNama: "SDN 1", sekolahAlamat: undefined } });
        expect(m.sekolah_nama).toBe("SDN 1");
        expect(m.sekolah_alamat).toBe("");
        expect(m.periode).toBe("");
    });
});

describe("fillTabunganWorksheet", () => {
    const tpl = {
        "1,1": "LAPORAN TABUNGAN SISWA {{sekolah_nama}}",
        "2,1": "Periode: {{periode}}",
        "3,1": "{{no}}",
        "3,2": "{{tanggal}}",
        "3,3": "{{siswa}}",
        "3,4": "{{kelas}}",
        "3,5": "{{tipe}}",
        "3,6": "{{nominal}}",
        "3,7": "=SUM(G3:G3)",
    };

    it("mengisi skalar dan baris contoh per transaksi", async () => {
        const ws = fakeSheet(tpl);
        const rows: TabunganExcelRow[] = [
            { tanggal: "16/10/2026", siswa: "Budi Santoso", kelas: "Kelas 1", tipe: "Setor", nominal: 50_000, status: "verified", petugas: "Siti" },
            { tanggal: "17/10/2026", siswa: "Ani", kelas: "Kelas 1", tipe: "Tarik", nominal: 20_000, status: "verified", petugas: "Siti" },
        ];
        const { rowCount, unknown } = await fillTabunganWorksheet(ws as never, input(rows));
        expect(rowCount).toBe(2);
        expect(unknown).toEqual([]);
        expect(ws.getRow(1).getCell(1).value).toBe("LAPORAN TABUNGAN SISWA SDN 1 Kenanga");
        expect(ws.getRow(2).getCell(1).value).toBe("Periode: Bulan Ini");
        // No. urut kini berupa NUMBER agar format template berlaku
        expect(ws.getRow(3).getCell(1).value).toBe(1);
        expect(ws.getRow(3).getCell(2).value).toBe("16/10/2026");
        expect(ws.getRow(3).getCell(6).value).toBe(50000);
    });

    it("melaporkan baris 0 bila tidak ada baris contoh", async () => {
        const ws = fakeSheet({ "1,1": "{{sekolah_nama}}" });
        const { rowCount } = await fillTabunganWorksheet(ws as never, input([{}] as any));
        expect(rowCount).toBe(0);
    });

    it("menandai variabel tak dikenal", async () => {
        const ws = fakeSheet({ "1,1": "{{sekolah_nama}}", "2,1": "{{no}}", "2,2": "{{typo}}" });
        const { unknown } = await fillTabunganWorksheet(ws as never, input([{}] as any));
        expect(unknown).toContain("typo");
    });

    it("melepas merge di bawah baris contoh lalu memasangnya kembali tergeser", async () => {
        const ws = fakeSheet(tpl, ["A5:C5"]);
        const rows: TabunganExcelRow[] = [
            { tanggal: "-", siswa: "-", kelas: "-", tipe: "-", nominal: 0, status: "-", petugas: "-" },
            { tanggal: "-", siswa: "-", kelas: "-", tipe: "-", nominal: 0, status: "-", petugas: "-" },
            { tanggal: "-", siswa: "-", kelas: "-", tipe: "-", nominal: 0, status: "-", petugas: "-" },
        ];
        await fillTabunganWorksheet(ws as never, input(rows));
        const fake = ws as never as { unmergedCalls: string[]; mergedCalls: string[] };
        // Baris contoh = 3, 3 baris data → delta = 2, merge A5:C5 → A7:C7.
        expect(fake.unmergedCalls).toContain("A5:C5");
        expect(fake.mergedCalls).toContain("A7:C7");
    });
});
