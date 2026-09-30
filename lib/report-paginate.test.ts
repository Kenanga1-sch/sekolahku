import { describe, expect, it } from "vitest";
import {
  cellFontSizePt,
  computePageBreaks,
  computeRowOffsets,
  paperContentSizePt,
  rowHeightPt,
} from "@/lib/report-paginate";
import { createDefaultWorkbook } from "@/lib/report-engine-v3";
import { cellKey, createSheet, type ReportWorkbook } from "@/lib/config/report-sheet";

function wbWith(sheet: ReturnType<typeof createSheet>, overrides?: Partial<ReportWorkbook>): ReportWorkbook {
  return { ...createDefaultWorkbook(), sheets: [sheet], showFooter: false, ...overrides };
}

describe("report-paginate — ukuran kertas", () => {
  it("A4 portrait mengurangi margin dengan benar", () => {
    const wb = createDefaultWorkbook();
    const s = paperContentSizePt(wb);
    // A4 = 210x297mm = 595.28 x 841.89pt; margin normal 36/45/40/40.
    expect(s.widthPt).toBeCloseTo(595.28, 0);
    expect(s.contentWidthPt).toBeCloseTo(595.28 - 80, 0);
    expect(s.contentHeightPt).toBeCloseTo(841.89 - 81, 0);
  });

  it("landscape menukar lebar/tinggi", () => {
    const wb = createDefaultWorkbook();
    const p = paperContentSizePt(wb);
    const l = paperContentSizePt({ ...wb, orientation: "landscape" });
    expect(l.widthPt).toBeCloseTo(p.heightPt, 0);
    expect(l.heightPt).toBeCloseTo(p.widthPt, 0);
  });
});

describe("report-paginate — tinggi baris", () => {
  it("mengikuti rumus PDF (font 9, lineHeight 1.4, padding 4)", () => {
    const sheet = createSheet({ cols: 3 });
    // ceil(9*1.4 + 8 + 2) = ceil(22.6) = 23
    expect(rowHeightPt(sheet, 0, 9)).toBe(23);
  });

  it("menghormati tinggi baris eksplisit", () => {
    const sheet = createSheet({ cols: 3, rowHeights: { 0: 50 } });
    expect(rowHeightPt(sheet, 0, 9)).toBe(50);
  });

  it("menambah tinggi baris untuk sel wrap panjang", () => {
    const sheet = createSheet({ cols: 2 });
    sheet.cells[cellKey(0, 0)] = { value: "x".repeat(200), wrap: true };
    const wrapCtx = { contentWidthPt: 500 };
    const h = rowHeightPt(sheet, 0, 9, undefined, wrapCtx);
    expect(h).toBeGreaterThan(rowHeightPt(sheet, 0, 9));
  });

  it("tidak menambah tinggi bila wrap tidak aktif", () => {
    const sheet = createSheet({ cols: 2 });
    sheet.cells[cellKey(0, 0)] = { value: "x".repeat(200) };
    const wrapCtx = { contentWidthPt: 500 };
    expect(rowHeightPt(sheet, 0, 9, undefined, wrapCtx)).toBe(rowHeightPt(sheet, 0, 9));
  });

  it("menggunakan font terbesar pada baris", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 0)] = { value: "kecil", fontSize: 8 };
    sheet.cells[cellKey(0, 2)] = { value: "besar", fontSize: 20 };
    expect(cellFontSizePt(sheet, 0, 9)).toBe(20);
    expect(rowHeightPt(sheet, 0, 9)).toBe(38);
  });

  it("menghitung newline eksplisit tanpa bergantung pada wrap", () => {
    const sheet = createSheet({ cols: 1 });
    sheet.cells[cellKey(0, 0)] = { value: "satu\ndua\ntiga" };
    expect(rowHeightPt(sheet, 0, 9, undefined, { contentWidthPt: 500 })).toBe(48);
  });
});

describe("report-paginate — batas halaman", () => {
  it("satu halaman bila konten sedikit", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 0)] = { value: "Judul" };
    const plan = computePageBreaks(sheet, wbWith(sheet));
    expect(plan.pageCount).toBe(1);
    expect(plan.breakAfterInputRow.size).toBe(0);
    // Default typography: font 11 → ceil(11*1.4 + 8 + 2) = 26.
    expect(plan.totalHeightPt).toBe(26);
  });

  it("totalHeightPt menjumlahkan tinggi, bukan jumlah baris", () => {
    const sheet = createSheet({ cols: 2, rowHeights: { 0: 30, 1: 45 } });
    sheet.cells[cellKey(0, 0)] = { value: "A" };
    sheet.cells[cellKey(1, 0)] = { value: "B" };
    expect(computePageBreaks(sheet, wbWith(sheet)).totalHeightPt).toBe(75);
  });

  it("memecah menjadi beberapa halaman dan menandai baris batas", () => {
    const sheet = createSheet({ cols: 3 });
    // 100 baris x 23pt = 2300pt > tinggi konten A4 (~760pt).
    for (let r = 0; r < 100; r++) {
      sheet.cells[cellKey(r, 0)] = { value: `Baris ${r + 1}` };
    }
    const plan = computePageBreaks(sheet, wbWith(sheet));
    expect(plan.pageCount).toBeGreaterThan(1);
    expect(plan.breakAfterInputRow.size).toBe(plan.pageCount - 1);
    // Tidak boleh ada batas di baris terakhir.
    expect(plan.breakAfterInputRow.has(99)).toBe(false);
  });

  it("memperhitungkan ekspansi zona ulang (jumlah record memengaruhi halaman)", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 0)] = { value: "Header" };
    sheet.cells[cellKey(1, 0)] = { value: "{nama}" }; // baris berulang

    const few = computePageBreaks(sheet, wbWith(sheet), { dataset: [{ nama: "A" }] });
    const many = computePageBreaks(sheet, wbWith(sheet), {
      dataset: Array.from({ length: 60 }, (_, i) => ({ nama: `Siswa ${i}` })),
    });

    expect(few.pageCount).toBe(1);
    expect(many.pageCount).toBeGreaterThan(1);
  });

  it("header ulang mengurangi kapasitas halaman berikutnya", () => {
    const make = (repeatHeader: boolean) => {
      const sheet = createSheet({ cols: 3 });
      sheet.cells[cellKey(0, 0)] = { value: "HALAMAN 1" };
      for (let r = 1; r <= 60; r++) sheet.cells[cellKey(r, 0)] = { value: "{nama}" };
      return computePageBreaks(
        sheet,
        wbWith(sheet, { headerRepeat: repeatHeader }),
        { dataset: Array.from({ length: 60 }, (_, i) => ({ nama: `N${i}` })) }
      );
    };
    const without = make(false);
    const withHeader = make(true);
    // Header mengulang mengurangi kapasitas ⇒ butuh halaman >= daripada tanpa.
    expect(withHeader.pageCount).toBeGreaterThanOrEqual(without.pageCount);
  });
});

describe("report-paginate — offset baris", () => {
  it("offset kumulatif sepanjang tinggi baris", () => {
    const sheet = createSheet({ cols: 3 });
    sheet.cells[cellKey(0, 0)] = { value: "A" };
    sheet.cells[cellKey(1, 0)] = { value: "B" };
    const offsets = computeRowOffsets(sheet, wbWith(sheet));
    expect(offsets[0].topPt).toBe(0);
    // Font default 11 → tinggi baris 26.
    expect(offsets[1].topPt).toBe(26);
    expect(offsets[1].topPt - offsets[0].topPt).toBe(26);
  });
});
