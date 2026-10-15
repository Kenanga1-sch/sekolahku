import { describe, expect, it } from "vitest";
import {
  fillInventoryWorksheet,
  inventoryRowValues,
  inventoryScalarMap,
  isInventoryRowVariable,
  shiftInventoryFormulaRows,
  substituteInventory,
  substituteInventoryCell,
  unknownInventoryVariables,
  type InventoryExcelInput,
} from "./inventory-excel";
import type { AssetRow } from "./report-data";

function asset(over: Partial<AssetRow> = {}): AssetRow {
  const quantity = over.quantity ?? 5;
  return {
    id: over.id ?? "a1",
    code: over.code ?? "INV/EL-2026-01",
    name: over.name ?? "Laptop",
    category: over.category ?? "Elektronik",
    roomName: over.roomName ?? "Ruang Guru",
    quantity,
    good: over.good ?? 3,
    lightDamaged: over.lightDamaged ?? 1,
    heavyDamaged: over.heavyDamaged ?? 1,
    lost: over.lost ?? 0,
    unclassified: over.unclassified ?? 0,
    price: over.price ?? 8_500_000,
    value: over.value ?? quantity * (over.price ?? 8_500_000),
    fundingSource: over.fundingSource ?? "BOS",
    fiscalYear: over.fiscalYear === undefined ? 2026 : over.fiscalYear,
    purchaseDate: over.purchaseDate ?? "2026-01-15T00:00:00Z",
    supplier: over.supplier ?? "CV Maju Jaya",
    invoiceNo: over.invoiceNo ?? "INV-2026-0001",
    serialNumber: over.serialNumber ?? "SN-12345",
    brand: over.brand ?? "Lenovo",
    model: over.model ?? "ThinkPad E14",
    acquisitionType: over.acquisitionType ?? "Pembelian",
  };
}

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

function input(rows: AssetRow[]): InventoryExcelInput {
  return {
    rows,
    scalars: {
      sekolahNama: "SDN 1 Kenanga",
      periode: "Posisi per 9 Oktober 2026",
      totalUnit: 5,
      totalNilaiAset: 42_500_000,
      jumlahRuangan: 1,
      jumlahJenis: rows.length,
    },
  };
}

describe("substituteInventory", () => {
  it("mengganti variabel dikenal, membiarkan yang asing", () => {
    expect(substituteInventory("Kode {{kode}} — {{typo}}", { kode: "INV/BK-2026-01" })).toBe(
      "Kode INV/BK-2026-01 — {{typo}}"
    );
  });
});

describe("substituteInventoryCell", () => {
  it("mengubah sel bernilai numerik murni menjadi NUMBER agar format angka berlaku", () => {
    expect(substituteInventoryCell("{{harga}}", { harga: 8_500_000 })).toBe(8_500_000);
    expect(substituteInventoryCell("{{jumlah}}", { jumlah: 5 })).toBe(5);
    expect(substituteInventoryCell("{{nilai}}", { nilai: 42_500_000 })).toBe(42_500_000);
    expect(substituteInventoryCell("{{total_nilai_aset}}", { total_nilai_aset: 57_500_000 })).toBe(
      57_500_000
    );
    // Spasi di ujung tetap dianggap sel numerik murni.
    expect(substituteInventoryCell(" {{jumlah}} ", { jumlah: 3 })).toBe(3);
  });

  it("menormalkan string angka numerik menjadi NUMBER", () => {
    expect(substituteInventoryCell("{{tahun_anggaran}}", { tahun_anggaran: "2026" })).toBe(2026);
  });

  it("tetap string untuk sel bertoken non-numerik atau gabungan teks", () => {
    expect(substituteInventoryCell("{{nama}}", { nama: "Laptop" })).toBe("Laptop");
    expect(substituteInventoryCell("NIP. {{nip}}", { nip: "19650101" })).toBe("NIP. 19650101");
    expect(substituteInventoryCell(" {{nama}}", { nama: "Laptop" })).toBe(" Laptop");
  });

  it("membiarkan sel non-numerik bernilai kosong tetap string kosong", () => {
    // {{jumlah}} bernilai "" → tetap string (bukan 0) supaya sel kosong tampil kosong.
    expect(substituteInventoryCell("{{jumlah}}", { jumlah: "" })).toBe("");
  });
});

describe("isInventoryRowVariable", () => {
  it("mengenali variabel baris dan menolak skalar", () => {
    expect(isInventoryRowVariable("{{kode}}")).toBe(true);
    expect(isInventoryRowVariable("{{nilai}}")).toBe(true);
    expect(isInventoryRowVariable("{{sekolah_nama}}")).toBe(false);
    expect(isInventoryRowVariable("teks biasa")).toBe(false);
  });
});

describe("unknownInventoryVariables", () => {
  it("mendeteksi variabel di luar kamus", () => {
    expect(unknownInventoryVariables(["{{kode}} {{nama}} {{kodee}}"])).toEqual(["kodee"]);
  });
});

describe("shiftInventoryFormulaRows", () => {
  it("menggeser referensi baris contoh, lalu baris lain tidak disentuh", () => {
    expect(shiftInventoryFormulaRows("SUM(G8:G8)", 8, 2)).toBe("SUM(G10:G10)");
    expect(shiftInventoryFormulaRows("SUM(G8:G9)", 8, 1)).toBe("SUM(G9:G9)");
    expect(shiftInventoryFormulaRows("SUM(G$8:G8)", 8, 1)).toBe("SUM(G$8:G9)");
  });
});

describe("inventoryRowValues", () => {
  it("memetakan AssetRow ke token kamus", () => {
    const v = inventoryRowValues(asset(), 1);
    expect(v.no).toBe(1);
    expect(v.kode).toBe("INV/EL-2026-01");
    expect(v.ruangan).toBe("Ruang Guru");
    expect(v.rusak_ringan).toBe(1);
    expect(v.nilai).toBe(42_500_000);
    expect(v.penyedia).toBe("CV Maju Jaya");
    expect(v.cara_perolehan).toBe("Pembelian");
  });

  it("fiscalYear null → string kosong (bukan 'null')", () => {
    const v = inventoryRowValues(asset({ fiscalYear: null }), 2);
    expect(v.tahun_anggaran).toBe("");
  });
});

describe("inventoryScalarMap", () => {
  it("mengosongkan nilai undefined, bukan mencetak undefined", () => {
    const m = inventoryScalarMap({ rows: [], scalars: { sekolahNama: "SDN 1" } });
    expect(m.sekolah_nama).toBe("SDN 1");
    expect(m.sekolah_alamat).toBe("");
    expect(m.periode).toBe("");
  });
});

describe("fillInventoryWorksheet", () => {
  const tpl = {
    "1,1": "LAPORAN ASET TETAP {{sekolah_nama}}",
    "2,1": "Periode: {{periode}}",
    "3,1": "{{no}}",
    "3,2": "{{kode}}",
    "3,3": "{{nama}}",
    "3,4": "{{ruangan}}",
    "3,5": "{{jumlah}}",
    "3,6": "{{nilai}}",
    "3,7": "=SUM(G3:G3)",
  };

  it("mengisi skalar dan baris contoh per aset", async () => {
    const ws = fakeSheet({ ...tpl });
    const rows = [asset({ id: "a1", kode: "INV/EL-2026-01" }), asset({ id: "a2", kode: "INV/EL-2026-02" })];
    const { rowCount, unknown } = await fillInventoryWorksheet(ws as never, input(rows));
    expect(rowCount).toBe(2);
    expect(unknown).toEqual([]);
    expect(ws.getRow(1).getCell(1).value).toBe("LAPORAN ASET TETAP SDN 1 Kenanga");
    expect(ws.getRow(2).getCell(1).value).toBe("Periode: Posisi per 9 Oktober 2026");
    // Baris data: pertama di baris contoh (3), kedua tergantung fakeSheet
    // (duplicateRow tidak benar-benar menyalin di fake) — cukup pastikan
    // baris contoh terisi benar. Kolom {{no}} kini berupa NUMBER (bukan string)
    // agar format angka template tetap berlaku saat dibuka di Excel/PDF.
    expect(ws.getRow(3).getCell(1).value).toBe(1);
    expect(ws.getRow(3).getCell(2).value).toBe("INV/EL-2026-01");
  });

  it("melaporkan baris 0 bila tidak ada baris contoh", async () => {
    const ws = fakeSheet({ "1,1": "{{sekolah_nama}}" });
    const { rowCount } = await fillInventoryWorksheet(ws as never, input([asset()]));
    expect(rowCount).toBe(0);
  });

  it("menandai variabel tak dikenal", async () => {
    const ws = fakeSheet({ "1,1": "{{sekolah_nama}}", "2,1": "{{kode}}" , "2,2": "{{salah}}", "3,1": "x" });
    const { unknown } = await fillInventoryWorksheet(ws as never, input([asset()]));
    expect(unknown).toContain("salah");
  });

  it("melepas merge di bawah baris contoh lalu memasangnya kembali tergeser", async () => {
    // Merge blok TTD di baris 6 (di bawah baris contoh 3) harus bergeser
    // sejauh jumlah aset − 1 = 2 → baris 8.
    const ws = fakeSheet({ ...tpl }, ["A6:C6"]);
    const rows = [asset({ id: "a1" }), asset({ id: "a2" }), asset({ id: "a3" })];
    await fillInventoryWorksheet(ws as never, input(rows));
    const fake = ws as never as { unmergedCalls: string[]; mergedCalls: string[] };
    expect(fake.unmergedCalls).toContain("A6:C6");
    expect(fake.mergedCalls).toContain("A8:C8");
  });

  it("mengisi baris Jumlah hanya bila template menyediakannya", async () => {
    // Baris contoh di baris 3; baris 4 diberi label "Jumlah" → SUM di kolom
    // {{jumlah}} (kolom 5) dan {{nilai}} (kolom 6).
    const ws = fakeSheet({ ...tpl, "4,1": "Jumlah" });
    const rows = [asset({ id: "a1", quantity: 5, value: 42_500_000 })];
    const { rowCount } = await fillInventoryWorksheet(ws as never, input(rows));
    expect(rowCount).toBe(1);
    // lastData = 3 (1 baris) → baris jumlah = 4.
    const c5 = ws.getRow(4).getCell(5).value as { formula?: string; result?: number };
    expect(c5.formula).toBe("SUM(E3:E3)");
    expect(c5.result).toBe(5);
    const c6 = ws.getRow(4).getCell(6).value as { formula?: string; result?: number };
    expect(c6.formula).toBe("SUM(F3:F3)");
    expect(c6.result).toBe(42_500_000);
  });

  it("tidak menimpa baris di bawah data bila tak ada label Jumlah", async () => {
    const ws = fakeSheet({ ...tpl, "4,1": "Mengetahui," });
    await fillInventoryWorksheet(ws as never, input([asset()]));
    expect(ws.getRow(4).getCell(1).value).toBe("Mengetahui,");
  });
});
