import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildPrintPages,
  getOffset,
  withOffset,
  normalizeAdjust,
  readAdjustStorage,
  writeAdjustStorage,
  DEFAULT_ADJUST,
  ROWS_PER_PAGE,
  parseMmValue,
  isAdjustDirty,
  readSettingsStorage,
  writeSettingsStorage,
  DEFAULT_CETAK_SETTINGS,
  type AdjustAll,
} from "./print-layout";
import type { StudentCard } from "./use-cetak-kartu";

function makeCards(n: number): StudentCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `S${String(i + 1).padStart(2, "0")}`,
    fullName: `Siswa ${i + 1}`,
    nisn: null,
    nis: null,
    kip: null,
    className: "4A",
    photo: null,
    qrCode: `QR${i + 1}`,
    gender: "L",
    birthPlace: null,
    birthDate: null,
  }));
}

describe("buildPrintPages — mode duplex", () => {
  it("16 kartu, 2 kolom → halaman berpasangan F1,B1,F2,B2 (ganjil depan, genap belakang)", () => {
    const pages = buildPrintPages({ cards: makeCards(16), cardsPerRow: 2, mode: "duplex", showBackSide: true });
    expect(pages).toHaveLength(4);
    expect(pages.map((p) => p.cells[0].side)).toEqual(["front", "back", "front", "back"]);
    // batch 1 = kartu 1-8 di halaman 1-2, batch 2 = kartu 9-16 di halaman 3-4
    expect(pages[0].cells).toHaveLength(ROWS_PER_PAGE * 2);
    expect(pages[0].cells[0].student.id).toBe("S01");
    // flipEdge long (default): sel belakang posisi (0,0) = pasangan cermin
    // dari depan (0,1) → S02 (bukan S01 lagi — itulah bug lama)
    expect(pages[1].cells[0].student.id).toBe("S02");
    expect(pages[2].cells[0].student.id).toBe("S09");
    expect(pages[3].cells[0].student.id).toBe("S10");
  });

  it("flipEdge long (default): tiap sel belakang = pasangan cermin kolom di depan", () => {
    const pages = buildPrintPages({ cards: makeCards(8), cardsPerRow: 2, mode: "duplex", showBackSide: true });
    const front = pages[0];
    const back = pages[1].cells;
    const frontByPos = new Map(front.cells.map((c) => [`${c.row},${c.col}`, c.student.id]));

    // posisi fisik halaman depan: col 0,1 berulang; row 0,0,1,1,2,2,3,3
    expect(front.cells.map((c) => c.col)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(front.cells.map((c) => c.row)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);

    expect(back).toHaveLength(8);
    for (const cell of back) {
      const pairId = frontByPos.get(`${cell.row},${1 - cell.col}`);
      expect(pairId, `back(${cell.row},${cell.col}) punya pasangan depan`).toBe(cell.student.id);
    }
    // kasus konkrit: depan baris-0 [S01|S02] → belakang baris-0 [S02|S01]
    const row0 = back.filter((c) => c.row === 0).sort((a, b) => a.col - b.col);
    expect(row0.map((c) => c.student.id)).toEqual(["S02", "S01"]);
  });

  it("flipEdge short: pasangan dibalik pada sumbu horizontal (baris terbalik)", () => {
    const pages = buildPrintPages({ cards: makeCards(8), cardsPerRow: 2, mode: "duplex", showBackSide: true, flipEdge: "short" });
    const frontByPos = new Map(pages[0].cells.map((c) => [`${c.row},${c.col}`, c.student.id]));
    expect(pages[1].cells).toHaveLength(8);
    for (const cell of pages[1].cells) {
      expect(frontByPos.get(`${3 - cell.row},${cell.col}`)).toBe(cell.student.id);
    }
    // baris atas belakang = pasangan baris bawah depan (S07|S08)
    const row0 = pages[1].cells.filter((c) => c.row === 0).sort((a, b) => a.col - b.col);
    expect(row0.map((c) => c.student.id)).toEqual(["S07", "S08"]);
  });

  it("flipEdge long eksplisit = default, dan perRow 1 → long identik / short membalik baris", () => {
    const def = buildPrintPages({ cards: makeCards(8), cardsPerRow: 2, mode: "duplex", showBackSide: true });
    const exp = buildPrintPages({ cards: makeCards(8), cardsPerRow: 2, mode: "duplex", showBackSide: true, flipEdge: "long" });
    expect(exp[1].cells.map((c) => c.student.id)).toEqual(def[1].cells.map((c) => c.student.id));

    const oneColLong = buildPrintPages({ cards: makeCards(4), cardsPerRow: 1, mode: "duplex", showBackSide: true });
    expect(oneColLong[1].cells.map((c) => c.student.id)).toEqual(oneColLong[0].cells.map((c) => c.student.id));

    const oneColShort = buildPrintPages({ cards: makeCards(4), cardsPerRow: 1, mode: "duplex", showBackSide: true, flipEdge: "short" });
    expect(oneColShort[1].cells.map((c) => c.student.id)).toEqual(["S04", "S03", "S02", "S01"]);
    expect(oneColShort[1].cells.map((c) => c.row)).toEqual([0, 1, 2, 3]);
  });

  it("tanpa sisi belakang → hanya halaman depan", () => {
    const pages = buildPrintPages({ cards: makeCards(16), cardsPerRow: 2, mode: "duplex", showBackSide: false });
    expect(pages).toHaveLength(2);
    expect(pages.every((p) => p.cells[0].side === "front")).toBe(true);
  });

  it("batch terakhir yang setengah penuh tetap menghasilkan 1 pasang halaman", () => {
    const pages = buildPrintPages({ cards: makeCards(9), cardsPerRow: 2, mode: "duplex", showBackSide: true });
    expect(pages).toHaveLength(4);
    expect(pages[2].cells).toHaveLength(1);
    expect(pages[3].cells).toHaveLength(1);
  });
});

describe("buildPrintPages — mode gabungan", () => {
  it("8 siswa, 2 kolom, dua sisi → 2 halaman; tiap sisi kartu sel sendiri, urutan f1,b1,f2,b2…", () => {
    const pages = buildPrintPages({ cards: makeCards(8), cardsPerRow: 2, mode: "combined", showBackSide: true });
    expect(pages).toHaveLength(2);
    const first = pages[0];
    expect(first.cells).toHaveLength(ROWS_PER_PAGE * 2);
    expect(first.cells.map((c) => `${c.side}:${c.student.id}`)).toEqual([
      "front:S01", "back:S01", "front:S02", "back:S02",
      "front:S03", "back:S03", "front:S04", "back:S04",
    ]);
    // baris = pasangan depan|belakang satu siswa
    expect(first.cells[0].side).toBe("front");
    expect(first.cells[1].side).toBe("back");
    expect(first.cells[1].student.id).toBe(first.cells[0].student.id);
    // tiap sel kolomnya sendiri: 0,1,0,1…
    expect(first.cells.map((c) => c.col)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
  });

  it("tanpa sisi belakang → hanya sel depan, 8 siswa 2 kolom = 1 halaman penuh", () => {
    const pages = buildPrintPages({ cards: makeCards(8), cardsPerRow: 2, mode: "combined", showBackSide: false });
    expect(pages).toHaveLength(1);
    expect(pages[0].cells.every((c) => c.side === "front")).toBe(true);
  });

  it("1 kartu per baris → pasangan depan+belakang menumpuk vertikal di kolom tunggal", () => {
    const pages = buildPrintPages({ cards: makeCards(2), cardsPerRow: 1, mode: "combined", showBackSide: true });
    expect(pages).toHaveLength(1);
    expect(pages[0].cells.map((c) => c.col)).toEqual([0, 0, 0, 0]);
    expect(pages[0].cells.map((c) => c.side)).toEqual(["front", "back", "front", "back"]);
  });

  it("tidak ada kartu → tidak ada halaman", () => {
    expect(buildPrintPages({ cards: [], cardsPerRow: 2, mode: "combined", showBackSide: true })).toHaveLength(0);
    expect(buildPrintPages({ cards: [], cardsPerRow: 2, mode: "duplex", showBackSide: true })).toHaveLength(0);
  });
});

describe("kalibrasi offset", () => {
  it("default duplex: depan x=-2, belakang x=11 (mempertahankan kalibrasi lama)", () => {
    expect(getOffset(DEFAULT_ADJUST, "duplex", "front", 0)).toEqual({ x: -2, y: 0 });
    expect(getOffset(DEFAULT_ADJUST, "duplex", "back", 1)).toEqual({ x: 11, y: 0 });
  });

  it("default gabungan: kedua sisi x=-2, terpisah dari duplex", () => {
    expect(getOffset(DEFAULT_ADJUST, "combined", "front", 0)).toEqual({ x: -2, y: 0 });
    expect(getOffset(DEFAULT_ADJUST, "combined", "back", 0)).toEqual({ x: -2, y: 0 });
  });

  it("mengubah mode duplex tidak mencemari mode gabungan", () => {
    const next = withOffset(DEFAULT_ADJUST, "duplex", "back", 0, "x", 5);
    expect(next.duplex.back[0]).toEqual({ x: 5, y: 0 });
    expect(next.combined).toEqual(DEFAULT_ADJUST.combined);
    expect(DEFAULT_ADJUST.duplex.back[0]).toEqual({ x: 11, y: 0 });
  });

  it("kolom di luar daftar jatuh ke kolom pertama, daftar kosong ke default mode itu", () => {
    expect(getOffset(DEFAULT_ADJUST, "duplex", "front", 5)).toEqual({ x: -2, y: 0 });
    const empty: AdjustAll = { duplex: { front: [], back: [] }, combined: { front: [], back: [] } };
    expect(getOffset(empty, "duplex", "back", 0)).toEqual({ x: 11, y: 0 });
    expect(getOffset(empty, "combined", "back", 0)).toEqual({ x: -2, y: 0 });
  });

  it("withOffset menambah kolom bila kurang dan tidak memutasi state lama", () => {
    const next = withOffset(DEFAULT_ADJUST, "duplex", "back", 3, "y", -1.5);
    expect(next.duplex.back).toHaveLength(4);
    expect(next.duplex.back[3]).toEqual({ x: 11, y: -1.5 });
    expect(DEFAULT_ADJUST.duplex.back).toHaveLength(2);
    expect(next.duplex.front).toEqual(DEFAULT_ADJUST.duplex.front);
  });

  it("normalizeAdjust mengisi bagian yang hilang dengan default per mode", () => {
    expect(normalizeAdjust(null)).toEqual(DEFAULT_ADJUST);
    expect(normalizeAdjust({ duplex: { front: [{ x: 1, y: 2 }] } }).combined).toEqual(DEFAULT_ADJUST.combined);
    expect(normalizeAdjust({ duplex: { front: "abc", back: [{ x: 1, y: 2 }] } }).duplex.front).toEqual(DEFAULT_ADJUST.duplex.front);
    expect(normalizeAdjust({ duplex: { front: [{ x: Number.NaN, y: 0 }] } }).duplex.front).toEqual(DEFAULT_ADJUST.duplex.front);
  });
});

describe("persistensi localStorage", () => {
  beforeEach(() => window.localStorage.clear());

  it("tulis lalu baca kembali (roundtrip)", () => {
    const custom: AdjustAll = {
      duplex: { front: [{ x: -1, y: 0.5 }, { x: -2, y: 0 }], back: [{ x: 9, y: 0 }, { x: 10, y: -1 }] },
      combined: { front: [{ x: 0, y: 0 }], back: [{ x: 0, y: 1 }] },
    };
    writeAdjustStorage(custom);
    expect(readAdjustStorage()).toEqual(custom);
  });

  it("baca tanpa data → null", () => {
    expect(readAdjustStorage()).toBeNull();
  });

  it("data rusak → default mode masing-masing (tidak melempar)", () => {
    window.localStorage.setItem("siswa-cetak-kartu-adjust", "{not-json");
    expect(readAdjustStorage()).toBeNull();
    window.localStorage.setItem("siswa-cetak-kartu-adjust", JSON.stringify({ duplex: 42 }));
    expect(readAdjustStorage()).toEqual(DEFAULT_ADJUST);
  });
});

describe("parseMmValue — koma & titik desimal", () => {
  it("koma desimal diparse sebagai titik (keyboard Indonesia)", () => {
    expect(parseMmValue("2,75")).toBe(2.75);
    expect(parseMmValue("-3,5")).toBe(-3.5);
    expect(parseMmValue("0,1")).toBe(0.1);
  });

  it("titik desimal tetap bekerja", () => {
    expect(parseMmValue("2.75")).toBe(2.75);
    expect(parseMmValue("-12.25")).toBe(-12.25);
  });

  it("bilangan bulat & negatif", () => {
    expect(parseMmValue("0")).toBe(0);
    expect(parseMmValue("-11")).toBe(-11);
    expect(parseMmValue(" 5 ")).toBe(5);
  });

  it("parsial tidak valid → null (bukan NaN yang meng-commit)", () => {
    expect(parseMmValue("")).toBeNull();
    expect(parseMmValue("-")).toBeNull();
    expect(parseMmValue(",")).toBeNull();
    expect(parseMmValue(".")).toBeNull();
    expect(parseMmValue("abc")).toBeNull();
    expect(parseMmValue("2,abc")).toBe(2); // parseFloat berhenti di koma-invalid
  });

  it("koma di tengah angka ganda ditangani parseFloat standar", () => {
    // "1,234,5" → normalisasi pertama koma saja → parseFloat stop → 1.234
    expect(parseMmValue("1,234,5")).toBe(1.234);
  });
});

describe("isAdjustDirty — indikator belum disimpan", () => {
  it("nilai sama → tidak dirty", () => {
    const a: AdjustAll = normalizeAdjust({ duplex: { front: [{ x: 5, y: 1 }] } });
    expect(isAdjustDirty(a, a)).toBe(false);
  });

  it("nilai berbeda → dirty", () => {
    const saved = DEFAULT_ADJUST;
    const current = withOffset(DEFAULT_ADJUST, "combined", "front", 0, "x", 3);
    expect(isAdjustDirty(current, saved)).toBe(true);
  });

  it("setelah save (current = saved) → tidak dirty lagi", () => {
    const current = withOffset(DEFAULT_ADJUST, "duplex", "back", 1, "y", -2);
    const saved = normalizeAdjust(current); // simulasi tersimpan
    expect(isAdjustDirty(current, saved)).toBe(false);
  });
});

describe("writeAdjustStorage — status keberhasilan (jujur)", () => {
  beforeEach(() => window.localStorage.clear());

  it("sukses → true", () => {
    expect(writeAdjustStorage(DEFAULT_ADJUST)).toBe(true);
  });

  it("localStorage throw (quota/blokir) → false, TIDAK lolos diam-diam", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(writeAdjustStorage(DEFAULT_ADJUST)).toBe(false);
    spy.mockRestore();
  });
});

describe("persistensi pengaturan tampilan (auto-save)", () => {
  beforeEach(() => window.localStorage.clear());

  it("roundtrip: tulis lalu baca kembali", () => {
    const s = { ...DEFAULT_CETAK_SETTINGS, cardsPerRow: "1", printMode: "duplex" as const, showBackSide: false, flipEdge: "short" as const, cardType: "nisn" as const };
    expect(writeSettingsStorage(s)).toBe(true);
    expect(readSettingsStorage()).toEqual(s);
  });

  it("baca tanpa data → null", () => {
    expect(readSettingsStorage()).toBeNull();
  });

  it("nilai tidak valid diganti default (sanitize)", () => {
    window.localStorage.setItem("siswa-cetak-kartu-settings", JSON.stringify({ printMode: "nope", cardsPerRow: "9", cardType: "xxx", showPhoto: "yes" }));
    expect(readSettingsStorage()).toEqual(DEFAULT_CETAK_SETTINGS);
  });

  it("data rusak → null (tidak melempar)", () => {
    window.localStorage.setItem("siswa-cetak-kartu-settings", "{broken");
    expect(readSettingsStorage()).toBeNull();
  });
});
