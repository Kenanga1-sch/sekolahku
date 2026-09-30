import { describe, expect, it } from "vitest";
import {
  createSheet,
  colWidthPx,
  colWidthPt,
  absoluteColWidths,
  totalColWidthPx,
  printedColWidthsPt,
  visibleColumnCount,
  rowHeightAt,
  printScaleOf,
  PX_TO_PT,
} from "./report-sheet";

describe("report-sheet — lebar kolom absolut", () => {
  it("PX_TO_PT adalah 0.75 (96dpi)", () => {
    expect(PX_TO_PT).toBeCloseTo(0.75, 10);
  });

  it("colWidthPx mengembalikan lebar tersimpan apa adanya", () => {
    const sheet = createSheet({ cols: 3, colWidths: [80, 160, 40] });
    expect(colWidthPx(sheet, 0)).toBe(80);
    expect(colWidthPx(sheet, 1)).toBe(160);
    expect(colWidthPx(sheet, 2)).toBe(40);
  });

  it("colWidthPt = px × 0.75", () => {
    const sheet = createSheet({ cols: 1, colWidths: [96] });
    expect(colWidthPt(sheet, 0)).toBe(72);
  });

  it("absoluteColWidths mengembalikan seluruh kolom", () => {
    const sheet = createSheet({ cols: 2, colWidths: [100, 200] });
    expect(absoluteColWidths(sheet)).toEqual([100, 200]);
    expect(totalColWidthPx(sheet)).toBe(300);
  });

  it("resize satu kolom tidak mengubah lebar kolom lain", () => {
    const sheet = createSheet({ cols: 3, colWidths: [96, 96, 96] });
    const resized = { ...sheet, colWidths: [300, 96, 96] };
    // Kolom lain tetap persis sama (tidak dinormalisasi).
    expect(colWidthPx(resized, 1)).toBe(96);
    expect(colWidthPx(resized, 2)).toBe(96);
    expect(absoluteColWidths(resized)).toEqual([300, 96, 96]);
  });
});

describe("report-sheet — lebar cetak absolut (tanpa auto-fill)", () => {
  it("tabel lebih sempit TIDAK diregangkan (kop_sek tetap 690pt)", () => {
    const sheet = createSheet({ cols: 23, colWidths: Array.from({ length: 23 }, () => 40) });
    const printed = printedColWidthsPt(sheet);
    const total = printed.reduce((a, b) => a + b, 0);
    // 23 × 40px × 0.75 = 690pt — apa yang didesain = apa yang dicetak.
    expect(total).toBeCloseTo(690, 5);
    expect(printed[0]).toBeCloseTo(30, 5);
  });

  it("lebar absolut dipertahankan", () => {
    const sheet = createSheet({ cols: 4, colWidths: [400, 400, 400, 400] });
    expect(printedColWidthsPt(sheet)).toEqual([300, 300, 300, 300]); // 400px × 0.75
  });

  it("kolom disembunyikan (0) tidak memakan lebar", () => {
    const sheet = createSheet({ cols: 3, colWidths: [96, 0, 96] });
    expect(printedColWidthsPt(sheet)).toEqual([72, 0, 72]);
  });

  it("visibleColumnCount memotong kolom yang melewati tepi", () => {
    // 4 kolom × 400px = 1200pt; konten 515pt → kolom 0 (300pt) muat, kolom 1
    // mulai di 300pt (<515) ikut sebagian, kolom 2 mulai 600pt dipotong.
    const sheet = createSheet({ cols: 4, colWidths: [400, 400, 400, 400] });
    expect(visibleColumnCount(sheet, 515)).toBe(2);
  });

  it("visibleColumnCount mengembalikan semua kolom bila muat", () => {
    const sheet = createSheet({ cols: 3, colWidths: [100, 100, 100] });
    expect(visibleColumnCount(sheet, 500)).toBe(3);
  });
});

describe("report-sheet — nilai minimum nol", () => {
  it("rowHeightAt mempertahankan 0 (hidden) dan undefined (auto)", () => {
    const sheet = createSheet({ cols: 1, rowHeights: { 0: 0, 1: 24 } });
    expect(rowHeightAt(sheet, 0)).toBe(0);
    expect(rowHeightAt(sheet, 1)).toBe(24);
    expect(rowHeightAt(sheet, 2)).toBeUndefined();
  });

  it("colWidthPx mempertahankan 0 (hidden)", () => {
    const sheet = createSheet({ cols: 2, colWidths: [0, 96] });
    expect(colWidthPx(sheet, 0)).toBe(0);
    expect(colWidthPx(sheet, 1)).toBe(96);
  });

  it("printScaleOf default 1", () => {
    const wb = { ...createSheet({ cols: 1 }) } as unknown;
    void wb;
    expect(printScaleOf({ printScale: undefined } as unknown as Parameters<typeof printScaleOf>[0])).toBe(1);
    expect(printScaleOf({ printScale: 0.8 } as unknown as Parameters<typeof printScaleOf>[0])).toBe(0.8);
  });
});
