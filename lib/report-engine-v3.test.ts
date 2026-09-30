import { describe, it, expect } from "vitest";
import {
  detectRepeatRows,
  planRowExpansion,
  evaluateSheet,
  evaluateWorkbook,
  evalFormula,
  createDefaultWorkbook,
  migrateReportWorkbook,
  deserializeWorkbook,
  serializeWorkbook,
  sheetRowCount,
} from "./report-engine-v3";
import { cellKey, createSheet, type ReportSheet } from "./config/report-sheet";

function makeSheet(rows: number, cols: number, cells: ReportSheet["cells"]): ReportSheet {
  return createSheet({ cols, cells });
}

describe("report-engine-v3 zone detection", () => {
  it("detectRepeatRows menemukan baris berisi variabel list", () => {
    const sheet = makeSheet(3, 3, {
      [cellKey(0, 0)]: { value: "Nama" },
      [cellKey(1, 0)]: { value: "{nama}" },
      [cellKey(2, 0)]: { value: "Total" },
    });
    expect(detectRepeatRows(sheet)).toEqual([1]);
  });

  it("detectRepeatRows menghormati flag repeatZone manual", () => {
    const sheet = makeSheet(2, 2, {
      [cellKey(0, 0)]: { value: "Header" },
      [cellKey(1, 0)]: { value: "baris", repeatZone: true },
    });
    expect(detectRepeatRows(sheet)).toEqual([1]);
  });

  it("planRowExpansion menggandakan baris zona sebanyak record", () => {
    const sheet = makeSheet(3, 2, {
      [cellKey(0, 0)]: { value: "Header" },
      [cellKey(1, 0)]: { value: "{nama}" },
      [cellKey(2, 0)]: { value: "Footer" },
    });
    const plan = planRowExpansion(sheet, 3);
    // Header + 3 record + footer = 5 baris output
    expect(plan.outputInputRows).toEqual([0, 1, 1, 1, 2]);
    expect(plan.recordIndexByOutput).toEqual([-1, 0, 1, 2, -1]);
  });

  it("planRowExpansion memakai minimal 1 record bila dataset kosong", () => {
    const sheet = makeSheet(1, 1, { [cellKey(0, 0)]: { value: "{nama}" } });
    const plan = planRowExpansion(sheet, 0);
    expect(plan.outputInputRows.length).toBe(1);
  });
});

describe("report-engine-v3 evaluate", () => {
  it("mengisi variabel list per record dan variabel scalar global", () => {
    const sheet = makeSheet(2, 3, {
      [cellKey(0, 0)]: { value: "{{laporan.judul}}", bold: true },
      [cellKey(1, 0)]: { value: "{nama}" },
      [cellKey(1, 1)]: { value: "{saldo}", format: "rupiah" },
    });
    const ev = evaluateSheet(sheet, {
      dataset: [
        { nama: "Ahmad", saldo: 500000 },
        { nama: "Budi", saldo: 750000 },
      ],
      global: { laporan: { judul: "REKAP" } },
    });
    expect(ev.outputRows).toBe(3); // 1 header + 2 record
    expect(ev.cellMap.get(cellKey(0, 0))?.text).toBe("REKAP");
    expect(ev.cellMap.get(cellKey(1, 0))?.text).toBe("Ahmad");
    expect(ev.cellMap.get(cellKey(2, 0))?.text).toBe("Budi");
    expect(ev.cellMap.get(cellKey(1, 1))?.text).toContain("500.000");
  });

  it("field list yang tidak ada di record menjadi kosong, bukan nomor baris", () => {
    const sheet = makeSheet(2, 3, {
      [cellKey(0, 0)]: { value: "{no}" },
      [cellKey(0, 1)]: { value: "{nama}" },
      [cellKey(0, 2)]: { value: "{tidak_ada}" },
    });
    const ev = evaluateSheet(sheet, {
      dataset: [{ nama: "Ahmad" }, { nama: "Budi" }],
    });
    // {no} tetap penghitung nomor baris
    expect(ev.cellMap.get(cellKey(0, 0))?.text).toBe("1");
    expect(ev.cellMap.get(cellKey(1, 0))?.text).toBe("2");
    // {nama} ada di record
    expect(ev.cellMap.get(cellKey(0, 1))?.text).toBe("Ahmad");
    // field yang tidak ada harus kosong, bukan nomor baris
    expect(ev.cellMap.get(cellKey(0, 2))?.text).toBe("");
    expect(ev.cellMap.get(cellKey(1, 2))?.text).toBe("");
  });

  it("{no} adalah penomoran baris otomatis, mengabaikan field 'no' di record", () => {
    const sheet = makeSheet(1, 1, { [cellKey(0, 0)]: { value: "{no}" } });
    const ev = evaluateSheet(sheet, {
      // record punya field 'no' bernilai 99, tapi {no} harus tetap 1,2,3
      dataset: [{ no: 99 }, { no: 99 }],
    });
    expect(ev.cellMap.get(cellKey(0, 0))?.text).toBe("1");
    expect(ev.cellMap.get(cellKey(1, 0))?.text).toBe("2");
  });

  it("multi-dataset: lembar memakai dataset bernama via datasetName", () => {
    const sheet: ReportSheet = {
      ...makeSheet(1, 2, {
        [cellKey(0, 0)]: { value: "{nama}" },
        [cellKey(0, 1)]: { value: "{kelas}" },
      }),
      datasetName: "siswa",
    };
    const ev = evaluateSheet(sheet, {
      datasets: {
        siswa: [
          { nama: "Ahmad", kelas: "7A" },
          { nama: "Budi", kelas: "7B" },
        ],
        aset: [{ nama: "Proyektor", kode: "AST-1" }],
      },
    });
    expect(ev.outputRows).toBe(2);
    expect(ev.cellMap.get(cellKey(0, 0))?.text).toBe("Ahmad");
    expect(ev.cellMap.get(cellKey(1, 0))?.text).toBe("Budi");
    expect(ev.cellMap.get(cellKey(0, 1))?.text).toBe("7A");
  });

  it("multi-dataset: {ns.field} membaca dataset lain (record pertama)", () => {
    const sheet: ReportSheet = {
      ...makeSheet(1, 2, {
        [cellKey(0, 0)]: { value: "{nama}" },
        [cellKey(0, 1)]: { value: "{aset.kode}" },
      }),
      datasetName: "siswa",
    };
    const ev = evaluateSheet(sheet, {
      datasets: {
        siswa: [{ nama: "Ahmad" }],
        aset: [{ kode: "AST-9" }],
      },
    });
    expect(ev.cellMap.get(cellKey(0, 1))?.text).toBe("AST-9");
  });

  it("tanpa datasets, perilaku lama tetap berlaku (dataset tunggal)", () => {
    const sheet = makeSheet(1, 1, { [cellKey(0, 0)]: { value: "{nama}" } });
    const ev = evaluateSheet(sheet, { dataset: [{ nama: "Lama" }] });
    expect(ev.cellMap.get(cellKey(0, 0))?.text).toBe("Lama");
  });

  it("menghitung rumus SUM/AVG/COUNT atas range", () => {
    const sheet = makeSheet(4, 3, {
      [cellKey(0, 1)]: { value: "10" },
      [cellKey(1, 1)]: { value: "20" },
      [cellKey(2, 1)]: { value: "30" },
      [cellKey(0, 2)]: { value: "=SUM(B1:B3)" },
      [cellKey(1, 2)]: { value: "=AVG(B1:B3)" },
      [cellKey(2, 2)]: { value: "=COUNT(B1:B3)" },
    });
    const ev = evaluateSheet(sheet, {});
    expect(ev.cellMap.get(cellKey(0, 2))?.text).toBe("60");
    expect(ev.cellMap.get(cellKey(1, 2))?.text).toBe("20");
    expect(ev.cellMap.get(cellKey(2, 2))?.text).toBe("3");
  });

  it("menangani pembagian nol", () => {
    const sheet = makeSheet(1, 2, {
      [cellKey(0, 0)]: { value: "=1/0" },
    });
    const ev = evaluateSheet(sheet, {});
    expect(ev.cellMap.get(cellKey(0, 0))?.text).toBe("#DIV0!");
  });

  it("mendukung IF, CONCAT, ROUND, UPPER", () => {
    const env = { getValue: () => "", getRange: () => [""], row: 0, col: 0 };
    expect(evalFormula("IF(1>0,\"YA\",\"TIDAK\")", env)).toBe("YA");
    expect(evalFormula("CONCAT(\"A\",\"B\")", env)).toBe("AB");
    expect(evalFormula("ROUND(3.14159,2)", env)).toBe("3.14");
    expect(evalFormula("UPPER(\"abc\")", env)).toBe("ABC");
  });

  it("IF short-circuit: cabang tak terpilih tidak dievaluasi", () => {
    const sheet = makeSheet(2, 2, {
      [cellKey(0, 0)]: { value: "0" },
      [cellKey(1, 0)]: { value: `=IF(A1=0,"aman",10/A1)` },
    });
    const ev = evaluateSheet(sheet, {});
    expect(ev.cellMap.get(cellKey(1, 0))?.text).toBe("aman");
  });

  it("rumus mengacu koordinat editor & melebar ke seluruh zona ulang", () => {
    // Baris 3 (editor) = baris template {nama}/{nilai}; baris 4 = TOTAL.
    const sheet = makeSheet(5, 2, {
      [cellKey(0, 0)]: { value: "Nama" },
      [cellKey(1, 0)]: { value: "{nama}" },
      [cellKey(1, 1)]: { value: "{nilai}" },
      [cellKey(2, 0)]: { value: "TOTAL" },
      [cellKey(2, 1)]: { value: "=SUM(B2:B2)" },
    });
    const ev = evaluateSheet(sheet, {
      dataset: [{ nama: "A", nilai: 10 }, { nama: "B", nilai: 20 }, { nama: "C", nilai: 30 }],
    });
    // output: header(1) + 3 record + TOTAL(1) = 5 baris; TOTAL di output baris 4
    expect(ev.outputRows).toBe(5);
    expect(ev.cellMap.get(cellKey(4, 1))?.text).toBe("60");
  });

  it("mendeteksi sirkularitas antar rumus", () => {
    const sheet = makeSheet(2, 2, {
      [cellKey(0, 0)]: { value: "=B1" },
      [cellKey(0, 1)]: { value: "=A1" },
    });
    const ev = evaluateSheet(sheet, {});
    expect(ev.cellMap.get(cellKey(0, 0))?.text).toBe("#CIRC!");
    expect(ev.cellMap.get(cellKey(0, 1))?.text).toBe("#CIRC!");
  });

  it("rumus membaca nilai sel lain lewat referensi", () => {
    const sheet = makeSheet(2, 2, {
      [cellKey(0, 0)]: { value: "5" },
      [cellKey(1, 0)]: { value: "=A1*3" },
    });
    const ev = evaluateSheet(sheet, {});
    expect(ev.cellMap.get(cellKey(1, 0))?.text).toBe("15");
  });

  it("tanda rowSpan menutup sel di bawahnya", () => {
    const sheet = makeSheet(3, 1, {
      [cellKey(0, 0)]: { value: "MERGE", rowSpan: 2 },
      [cellKey(2, 0)]: { value: "Bawah" },
    });
    const ev = evaluateSheet(sheet, {});
    expect(ev.occupied.has(cellKey(1, 0))).toBe(true);
  });
});

describe("report-engine-v3 migration", () => {
  it("createDefaultWorkbook memakai schema v3 dengan kertas kerja kosong", () => {
    const wb = createDefaultWorkbook();
    expect(wb.schemaVersion).toBe(3);
    expect(wb.sheets.length).toBe(1);
    expect(wb.typography.baseFontSize).toBe(11);
    // Kertas kerja default kosong: belum ada sel terisi.
    expect(sheetRowCount(wb.sheets[0])).toBe(0);
  });

  it("migrate dari v2 (blocks) membuat sheet dengan sel tabel & header", () => {
    const legacyV2 = {
      schemaVersion: 2,
      paperSize: "F4",
      orientation: "landscape",
      pages: [
        {
          id: "p1",
          name: "Legacy",
          rows: [
            {
              id: "r1",
              columns: [
                {
                  id: "c1",
                  widthPct: 100,
                  blocks: [
                    { instanceId: "b1", blockId: "judul_laporan", enabled: true, data: { judul: "REKAP" } },
                    {
                      instanceId: "b2",
                      blockId: "tabel_laporan",
                      enabled: true,
                      data: {
                        columns: [
                          { key: "no", label: "No", align: "center" },
                          { key: "nama", label: "Nama", align: "left" },
                          { key: "saldo", label: "Saldo", align: "right", autoSum: true, format: "rupiah" },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const wb = migrateReportWorkbook(legacyV2);
    expect(wb.schemaVersion).toBe(3);
    expect(wb.paperSize).toBe("F4");
    const sheet = wb.sheets[0];
    const allValues = Object.values(sheet.cells).map((c) => c.value).join("|");
    expect(allValues).toContain("REKAP");
    expect(allValues).toContain("Nama");
    expect(allValues).toContain("{nama}");
    expect(allValues).toContain("TOTAL");
    expect(allValues).toContain("=SUM(");
  });

  it("migrate dari v1 (blocks datar) tetap bekerja", () => {
    const legacyV1 = {
      schemaVersion: 1,
      pages: [
        {
          id: "p1",
          name: "V1",
          blocks: [{ instanceId: "x", blockId: "judul_laporan", enabled: true, data: { judul: "JUDUL" } }],
        },
      ],
    };
    const wb = migrateReportWorkbook(legacyV1);
    expect(wb.schemaVersion).toBe(3);
    const values = Object.values(wb.sheets[0].cells).map((c) => c.value).join("|");
    expect(values).toContain("JUDUL");
  });

  it("serialize & deserialize bolak-balik mempertahankan workbook", () => {
    const wb = createDefaultWorkbook();
    const restored = deserializeWorkbook(serializeWorkbook(wb));
    expect(restored.schemaVersion).toBe(3);
    expect(restored.sheets.length).toBe(1);
  });

  it("deserializeWorkbook memigrasi JSON v2 lama", () => {
    const v2 = JSON.stringify({
      schemaVersion: 2,
      pages: [{ id: "p", name: "P", rows: [{ id: "r", columns: [{ id: "c", widthPct: 100, blocks: [] }] }] }],
    });
    const wb = deserializeWorkbook(v2);
    expect(wb.schemaVersion).toBe(3);
  });

  it("deserializeWorkbook menormalkan sheet v3 yang aman", () => {
    const wb = deserializeWorkbook(JSON.stringify({
      schemaVersion: 3,
      sheets: [{ cols: 2, colWidths: [120, -1], cells: { "0,0": { value: "A" } } }],
    }));
    expect(wb.sheets[0]).toMatchObject({ id: "sheet-1", name: "Lembar 1", colWidths: [120, 96] });
    expect(wb.paperSize).toBe("A4");
  });

  it("deserializeWorkbook menolak sheet v3 malformed", () => {
    expect(() => deserializeWorkbook(JSON.stringify({
      schemaVersion: 3,
      sheets: [{ cols: 1, cells: { "0,1": { value: "di luar kolom" } } }],
    }))).toThrow("Sel sheet v3 tidak valid");
  });

  it("deserializeWorkbook tidak memigrasi schema sheet masa depan sebagai pages lama", () => {
    expect(() => deserializeWorkbook(JSON.stringify({
      schemaVersion: 4,
      sheets: [],
      pages: [],
    }))).toThrow("Versi schema sheet tidak didukung");
  });

  it("serialize & deserialize mempertahankan shapes", () => {
    const wb = createDefaultWorkbook();
    wb.sheets[0].shapes = [
      { id: "s1", type: "line", x: 10, y: 20, width: 200, height: 0, stroke: "#ff0000", strokeWidth: 2 },
      { id: "s2", type: "rect", x: 5, y: 60, width: 80, height: 40, fill: "#00ff00" },
    ];
    const restored = deserializeWorkbook(serializeWorkbook(wb));
    expect(restored.sheets[0].shapes).toEqual(wb.sheets[0].shapes);
  });

  it("deserializeWorkbook menormalkan shapes rusak dan membuang entri tak valid", () => {    const wb = deserializeWorkbook(JSON.stringify({
      schemaVersion: 3,
      sheets: [{
        cols: 2,
        cells: { "0,0": { value: "A" } },
        shapes: [
          { id: "ok", type: "rect", x: 1, y: 2, width: 30, height: 10 },
          { type: "segitiga", x: 0, y: 0 },
          "bukan objek",
          { type: "line", x: "bukan angka", width: -5 },
        ],
      }],
    }));
    const shapes = wb.sheets[0].shapes!;
    expect(shapes).toHaveLength(2);
    expect(shapes[0]).toMatchObject({ id: "ok", type: "rect", width: 30 });
    // shape-1: id auto, x fallback 0, width diklem >= 0
    expect(shapes[1]).toMatchObject({ id: "shape-3", type: "line", x: 0, width: 0 });
  });

  it("serialize & deserialize mempertahankan images", () => {
    const wb = createDefaultWorkbook();
    wb.sheets[0].images = [{ id: "i1", src: "/uploads/uploads/a.png", x: 10, y: 20, width: 90, height: 90 }];
    const restored = deserializeWorkbook(serializeWorkbook(wb));
    expect(restored.sheets[0].images).toEqual(wb.sheets[0].images);
  });

  it("deserializeWorkbook membuang gambar tanpa src valid", () => {
    const wb = deserializeWorkbook(JSON.stringify({
      schemaVersion: 3,
      sheets: [{
        cols: 2,
        cells: { "0,0": { value: "A" } },
        images: [
          { id: "ok", src: "/x.png", x: 1, y: 2, width: 30, height: 30 },
          { src: "" },
          "bukan objek",
          { id: "no-src" },
        ],
      }],
    }));
    expect(wb.sheets[0].images).toHaveLength(1);
    expect(wb.sheets[0].images![0]).toMatchObject({ id: "ok", src: "/x.png" });
  });
});

describe("report-engine-v3 evaluateWorkbook", () => {
  it("mengevaluasi seluruh sheet dalam workbook", () => {
    const wb = createDefaultWorkbook();
    const ev = evaluateWorkbook(wb, { dataset: [{ nama: "A" }] });
    expect(ev.sheets.length).toBe(1);
  });
});
