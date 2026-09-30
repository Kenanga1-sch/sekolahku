import { describe, it, expect } from "vitest";
import {
  extrapolateSeries,
  splitNumericPattern,
  blockToTsv,
  tsvToMatrix,
  extractBlock,
  normalizeBounds,
  adjustFormulaRefs,
  matchConditional,
  conditionalStyleFor,
  patchCells,
  extractVisualStyle,
  rebaseBlockFormula,
  insertRows,
  deleteRows,
  insertColumns,
  deleteColumns,
  fillSpans,
} from "./report-sheet-ops";
import { cellKey, createSheet, type ConditionalRule } from "./config/report-sheet";

describe("extrapolateSeries", () => {
  it("melanjutkan deret angka 1,2 → 3,4,5", () => {
    expect(extrapolateSeries(["1", "2"], 3)).toEqual(["3", "4", "5"]);
  });

  it("melanjutkan deret angka dengan langkah 5", () => {
    expect(extrapolateSeries(["10", "15"], 2)).toEqual(["20", "25"]);
  });

  it("mengulang angka tunggal tanpa menaikkan", () => {
    expect(extrapolateSeries(["7"], 3)).toEqual(["7", "7", "7"]);
  });

  it("melanjutkan pola teks berangka (Item 1)", () => {
    expect(extrapolateSeries(["Item 1", "Item 2"], 2)).toEqual(["Item 3", "Item 4"]);
  });

  it("mempertahankan suffix pada teks berangka", () => {
    expect(extrapolateSeries(["A1x", "A2x"], 2)).toEqual(["A3x", "A4x"]);
  });

  it("menyalin teks biasa", () => {
    expect(extrapolateSeries(["Nama"], 2)).toEqual(["Nama", "Nama"]);
  });

  it("menyalin nilai terakhir bila bukan deret", () => {
    expect(extrapolateSeries(["foo", "bar"], 2)).toEqual(["bar", "bar"]);
  });

  it("melanjutkan deret nama hari", () => {
    expect(extrapolateSeries(["Senin", "Selasa"], 3)).toEqual(["Rabu", "Kamis", "Jumat"]);
  });

  it("membungkus deret nama hari (Sabtu → Minggu)", () => {
    expect(extrapolateSeries(["Sabtu"], 2)).toEqual(["Minggu", "Senin"]);
  });

  it("melanjutkan deret nama bulan", () => {
    expect(extrapolateSeries(["Januari", "Februari"], 2)).toEqual(["Maret", "April"]);
  });
});

describe("splitNumericPattern", () => {
  it("memisahkan prefix, angka, suffix", () => {
    expect(splitNumericPattern("Item 3a")).toEqual({ prefix: "Item ", num: 3, suffix: "a" });
  });
  it("null bila tidak ada angka", () => {
    expect(splitNumericPattern("Nama")).toBeNull();
  });
});

describe("tsv", () => {
  it("blok → TSV", () => {
    const block = {
      rows: 2,
      cols: 2,
      values: [["a", "b"], ["c", "d"]],
      styles: [[undefined, undefined], [undefined, undefined]],
    };
    expect(blockToTsv(block)).toBe("a\tb\nc\td");
  });
  it("TSV → matriks", () => {
    expect(tsvToMatrix("a\tb\nc\td\n")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("extractBlock", () => {
  it("mengambil nilai & gaya dari sheet", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 0)] = { value: "x", bold: true };
    sheet.cells[cellKey(1, 1)] = { value: "y" };
    const block = extractBlock(sheet, { r0: 0, c0: 0, r1: 1, c1: 2 });
    expect(block.rows).toBe(2);
    expect(block.cols).toBe(3);
    expect(block.values[0][0]).toBe("x");
    expect(block.values[1][1]).toBe("y");
    expect(block.styles[0][0]).toEqual({ bold: true });
    expect(block.source).toEqual({ r: 0, c: 0 });
  });

  it("memisahkan gaya visual dari struktur sel", () => {
    expect(extractVisualStyle({ value: "x", bold: true, colSpan: 2, rowSpan: 3, repeatZone: true })).toEqual({ bold: true });
  });

  it("merebase rumus dari koordinat sumber", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(2, 1)] = { value: "=A1" };
    expect(rebaseBlockFormula(extractBlock(sheet, { r0: 2, c0: 1, r1: 2, c1: 1 }), 0, 0, 4, 2)).toBe("=B3");
  });
});

describe("normalizeBounds", () => {
  it("mengurutkan bounds terbalik", () => {
    expect(normalizeBounds({ r0: 3, c0: 4, r1: 1, c1: 2 })).toEqual({ r0: 1, c0: 2, r1: 3, c1: 4 });
  });
});

describe("patchCells", () => {
  it("menerapkan format ke seluruh rentang tanpa mengubah sheet asal", () => {
    const sheet = createSheet({ cols: 4 });
    sheet.cells[cellKey(5, 1)] = { value: "awal", italic: true };
    const next = patchCells(sheet, { r0: 8, c0: 2, r1: 5, c1: 1 }, { bold: true, color: "#123456" });
    for (let r = 5; r <= 8; r++) {
      for (let c = 1; c <= 2; c++) expect(next.cells[cellKey(r, c)]).toMatchObject({ bold: true, color: "#123456" });
    }
    expect(next.cells[cellKey(5, 1)]).toMatchObject({ value: "awal", italic: true });
    expect(sheet.cells[cellKey(5, 1)]).not.toHaveProperty("bold");
    expect(next.cells[cellKey(5, 0)]).toBeUndefined();
  });
});

describe("adjustFormulaRefs", () => {
  it("menggeser referensi relatif", () => {
    expect(adjustFormulaRefs("SUM(A1:A2)", 2, 0)).toBe("SUM(A3:A4)");
  });
  it("tidak menggeser referensi absolut", () => {
    expect(adjustFormulaRefs("A1+$A$1", 1, 1)).toBe("B2+$A$1");
  });
  it("tidak mengubah string literal", () => {
    expect(adjustFormulaRefs('IF(A1>0;"A1";A2)', 1, 0)).toBe('IF(A2>0;"A1";A3)');
  });
  it("menghasilkan REF pada batas negatif", () => {
    expect(adjustFormulaRefs("A1+$A1+A$1", -1, -1)).toBe("#REF!+#REF!+#REF!");
  });
});

describe("perubahan struktur", () => {
  it("menyisipkan dan menghapus baris beserta tinggi dan span", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(1, 0)] = { value: "=A1", rowSpan: 3 };
    sheet.rowHeights = { 1: 20, 3: 40 };
    const inserted = insertRows(sheet, 2, 1);
    expect(inserted.cells[cellKey(1, 0)]).toMatchObject({ rowSpan: 4 });
    expect(inserted.rowHeights).toEqual({ 1: 20, 4: 40 });
    expect(deleteRows(inserted, 2, 1)).toEqual(sheet);
  });

  it("menyisipkan dan menghapus kolom beserta lebar, rumus, span, dan conditional", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 1)] = { value: "=A1", colSpan: 2 };
    sheet.conditionals = [{ col: 1, op: "gt", value: 0 }, { col: -1, op: "notEmpty" }];
    const inserted = insertColumns(sheet, 1, 1);
    expect(inserted.cells[cellKey(0, 2)]).toMatchObject({ value: "=A1", colSpan: 2 });
    expect(inserted.conditionals?.map((rule) => rule.col)).toEqual([2, -1]);
    expect(inserted.colWidths).toHaveLength(4);
    expect(deleteColumns(inserted, 1, 1)).toEqual(sheet);
  });

  it("membuang conditional pada kolom yang dihapus", () => {
    const sheet = createSheet({ cols: 2 });
    sheet.conditionals = [{ col: 0, op: "notEmpty" }, { col: 1, op: "notEmpty" }];
    expect(deleteColumns(sheet, 0).conditionals?.map((rule) => rule.col)).toEqual([0]);
  });
});

describe("matchConditional", () => {
  const base: ConditionalRule = { col: -1, op: "gt", value: 0 };
  it("gt", () => expect(matchConditional(base, "5")).toBe(true));
  it("gt false", () => expect(matchConditional(base, "-1")).toBe(false));
  it("contains", () => expect(matchConditional({ col: -1, op: "contains", value: "Aktif" }, "Siswa Aktif")).toBe(true));
  it("notEmpty", () => expect(matchConditional({ col: -1, op: "notEmpty" }, "x")).toBe(true));
  it("notEmpty false", () => expect(matchConditional({ col: -1, op: "notEmpty" }, "  ")).toBe(false));
});

describe("conditionalStyleFor", () => {
  it("menerapkan aturan hanya pada kolom sasaran", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.conditionals = [{ col: 2, op: "gt", value: 0, bg: "#f00" }];
    expect(conditionalStyleFor(sheet, 0, 2, "5")?.bg).toBe("#f00");
    expect(conditionalStyleFor(sheet, 0, 1, "5")).toBeNull();
  });
});

describe("fillSpans", () => {
  it("mengulang span horizontal ke bawah", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 0)] = { value: "kop", colSpan: 2 };
    const plan = fillSpans(sheet, { r0: 0, c0: 0, r1: 0, c1: 0 }, "down", 2);
    expect(plan.spans).toEqual([
      { r: 1, c: 0, colSpan: 2, rowSpan: 1, sourceR: 0, sourceC: 0 },
      { r: 2, c: 0, colSpan: 2, rowSpan: 1, sourceR: 0, sourceC: 0 },
    ]);
    // Pengulangan span berikutnya tidak menimpa anchor span sebelumnya.
    expect(plan.coveredToRemove).toContain(cellKey(1, 1));
    expect(plan.coveredToRemove).toContain(cellKey(2, 1));
  });

  it("meringkas span baris ke atas", () => {
    const sheet = createSheet({ cols: 2 });
    sheet.cells[cellKey(2, 0)] = { rowSpan: 2 };
    const plan = fillSpans(sheet, { r0: 2, c0: 0, r1: 3, c1: 0 }, "up", 1);
    expect(plan.spans).toEqual([
      { r: 0, c: 0, colSpan: 1, rowSpan: 2, sourceR: 2, sourceC: 0 },
    ]);
    expect(plan.coveredToRemove).toEqual([cellKey(1, 0)]);
  });

  it("hanya mengulang span vertikal saat fill horizontal", () => {
    const sheet = createSheet({ cols: 4 });
    sheet.cells[cellKey(0, 0)] = { rowSpan: 2 };
    sheet.cells[cellKey(0, 1)] = { colSpan: 2 };
    const right = fillSpans(sheet, { r0: 0, c0: 0, r1: 0, c1: 1 }, "right", 1);
    // Hanya anchor rowSpan>1 yang diulang; span horizontal diabaikan.
    expect(right.spans).toEqual([
      { r: 0, c: 2, colSpan: 1, rowSpan: 2, sourceR: 0, sourceC: 0 },
    ]);
  });

  it("mengulang span ke kiri", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 2)] = { rowSpan: 2 };
    const plan = fillSpans(sheet, { r0: 0, c0: 2, r1: 0, c1: 2 }, "left", 1);
    expect(plan.spans).toEqual([
      { r: 0, c: 1, colSpan: 1, rowSpan: 2, sourceR: 0, sourceC: 2 },
    ]);
    expect(plan.coveredToRemove).toEqual([cellKey(1, 1)]);
  });

  it("mengulang pola multi-anchor mengikuti tinggi sumber", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 0)] = { colSpan: 2 };
    sheet.cells[cellKey(2, 0)] = { colSpan: 2 };
    // Sumber 3 baris: pola A0:B0 di baris 0, A2:B2 di baris 2.
    const plan = fillSpans(sheet, { r0: 0, c0: 0, r1: 2, c1: 0 }, "down", 1);
    expect(plan.spans).toEqual([
      { r: 3, c: 0, colSpan: 2, rowSpan: 1, sourceR: 0, sourceC: 0 },
      { r: 5, c: 0, colSpan: 2, rowSpan: 1, sourceR: 2, sourceC: 0 },
    ]);
  });

  it("tidak menghasilkan span bila sumber tidak punya merge", () => {
    const sheet = createSheet({ cols: 2 });
    sheet.cells[cellKey(0, 0)] = { value: "x" };
    expect(fillSpans(sheet, { r0: 0, c0: 0, r1: 0, c1: 0 }, "down", 3)).toEqual({
      spans: [],
      coveredToRemove: [],
    });
  });

  it("menjepit span pada batas kolom terakhir", () => {
    const sheet = createSheet({ cols: 2 });
    sheet.cells[cellKey(0, 1)] = { value: "x" }; // tanpa span, sumber abaikan
    sheet.cells[cellKey(0, 0)] = { colSpan: 3 };
    const plan = fillSpans(sheet, { r0: 0, c0: 0, r1: 0, c1: 0 }, "down", 1);
    expect(plan.spans[0]).toMatchObject({ colSpan: 2 });
  });

  // Meniru urutan penerapan di sheet-grid.applyFillSpans: tulis anchor span lalu
  // hapus sel tertutup. Memastikan hasil akhirnya merged yang valid (tanpa sel
  // yatim yang menimpa area gabungan).
  function applyPlan(sheet: ReturnType<typeof createSheet>, plan: ReturnType<typeof fillSpans>) {
    const next = { ...sheet, cells: { ...sheet.cells } };
    const anchors = new Set(plan.spans.map((s) => cellKey(s.r, s.c)));
    for (const key of plan.coveredToRemove) {
      if (!anchors.has(key)) delete next.cells[key];
    }
    for (const s of plan.spans) {
      const source = sheet.cells[cellKey(s.sourceR, s.sourceC)];
      const merged = { ...(source?.value !== undefined ? { value: source.value } : {}), colSpan: s.colSpan, rowSpan: s.rowSpan };
      if (merged.colSpan === 1) delete merged.colSpan;
      if (merged.rowSpan === 1) delete merged.rowSpan;
      next.cells[cellKey(s.r, s.c)] = merged;
    }
    return next;
  }

  it("hasil fill bawah: anchor merged dengan nilai tersalin tanpa sel yatim", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 0)] = { value: "KOP", colSpan: 2 };
    const b = { r0: 0, c0: 0, r1: 0, c1: 1 };
    const next = applyPlan(sheet, fillSpans(sheet, b, "down", 2));
    expect(next.cells[cellKey(1, 0)]).toEqual({ value: "KOP", colSpan: 2 });
    expect(next.cells[cellKey(2, 0)]).toEqual({ value: "KOP", colSpan: 2 });
    expect(next.cells[cellKey(1, 1)]).toBeUndefined();
    expect(next.cells[cellKey(2, 1)]).toBeUndefined();
  });
});
