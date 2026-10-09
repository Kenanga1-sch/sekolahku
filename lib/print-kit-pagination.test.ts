import { describe, expect, it } from "vitest";
import { applyPagination, printableHeightPt } from "./print-kit";

function fakeSheet(rowCount: number, heights: Record<number, number> = {}) {
  const rows: Record<number, { height?: number }> = {};
  for (let n = 1; n <= rowCount; n++) rows[n] = { height: heights[n] };
  return {
    rowCount,
    getRow: (n: number) => (rows[n] ??= {}),
    rows,
    rowBreaks: [] as { id: number; max: number; man: number }[],
  };
}

describe("printableHeightPt", () => {
  it("F4 landscape margin 10mm: tinggi = (215.9 − 20) mm", () => {
    const h = printableHeightPt("F4", "landscape", {});
    expect(h).toBeCloseTo(((215 - 20) / 25.4) * 72, 0);
  });
});

describe("applyPagination", () => {
  it("muat satu halaman → tanpa page break & tanpa ubah tinggi", () => {
    const ws = fakeSheet(20);
    const ok = applyPagination(ws, {
      paperSize: "F4", orientation: "landscape",
      dataStartRow: 8, dataEndRow: 12, keepRows: 3,
      signatureStartRow: 14, signatureEndRow: 19,
    });
    expect(ok).toBe(true);
    expect(ws.rowBreaks).toHaveLength(0);
  });

  it("melebihi satu halaman → page break sebelum blok TTD, baris data naik agar halaman 1 penuh", () => {
    const ws = fakeSheet(60);
    const ok = applyPagination(ws, {
      paperSize: "F4", orientation: "landscape",
      dataStartRow: 8, dataEndRow: 47, keepRows: 3,
      signatureStartRow: 50, signatureEndRow: 56,
    });
    expect(ok).toBe(true);
    expect(ws.rowBreaks).toHaveLength(1);
    const brk = ws.rowBreaks[0].id;
    expect(brk).toBeLessThan(47);
    expect(brk).toBeGreaterThanOrEqual(8);
    expect(ws.getRow(8).height).toBeGreaterThanOrEqual(15);
  });

  it("blok TTD lebih tinggi dari satu halaman → tidak diubah", () => {
    const ws = fakeSheet(400, { 300: 2000 });
    const ok = applyPagination(ws, {
      paperSize: "F4", orientation: "landscape",
      dataStartRow: 8, dataEndRow: 20, keepRows: 3,
      signatureStartRow: 300, signatureEndRow: 300,
    });
    expect(ok).toBe(false);
    expect(ws.rowBreaks).toHaveLength(0);
  });
});
