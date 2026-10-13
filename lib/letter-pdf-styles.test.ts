// Tes jaring pengaman untuk buildStyles — mengunci pemetaan standar (font,
// ukuran, margin paragraf) ke style PDF, agar pecahan refactor tak mengubah hasil.
import { describe, it, expect } from "vitest";
import { buildStyles } from "./letter-pdf-styles";
import type { LetterStandard } from "@/lib/config/letter-standards";

function makeStandard(overrides: Partial<LetterStandard["typography"]> = {}): LetterStandard {
  return {
    id: "std",
    name: "Standar",
    margins: { top: 20, right: 20, bottom: 20, left: 25 },
    typography: {
      fontFamily: "Arial",
      fontSize: 12,
      lineHeight: 1.5,
      headerFontSize: 16,
      paragraphSpacing: 8,
      ...overrides,
    },
  } as unknown as LetterStandard;
}

describe("buildStyles", () => {
  it("memetakan margin & font dari standar", () => {
    const s = buildStyles(makeStandard());
    expect(s.page.paddingTop).toBe(20);
    expect(s.page.paddingLeft).toBe(25);
    expect(s.page.fontSize).toBe(12);
    expect(s.page.fontFamily).toBe("Helvetica");
  });

  it("memakai paragraphSpacing bila ada, fallback ke 6", () => {
    expect(buildStyles(makeStandard({ paragraphSpacing: 10 })).paragraf.marginBottom).toBe(10);
    expect(buildStyles(makeStandard({ paragraphSpacing: 0 })).paragraf.marginBottom).toBe(6);
  });

  it("menurunkan headerFontSize untuk baris instansi/dinas", () => {
    const s = buildStyles(makeStandard({ headerFontSize: 16 }));
    expect(s.kopInstansi.fontSize).toBe(13);
    expect(s.kopSekolah.fontSize).toBe(16);
    expect(s.kopAlamat.fontSize).toBe(9);
  });
});
