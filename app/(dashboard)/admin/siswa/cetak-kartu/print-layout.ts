import type { StudentCard } from "./use-cetak-kartu";

/**
 * Tata letak lembar cetak kartu (A4, 4 baris) untuk mode duplex dan gabungan,
 * plus model kalibrasi posisi (offset mm per sisi per kolom, terpisah per mode).
 *
 * Semua fungsi di sini murni (tanpa DOM) supaya bisa diuji unit-test:
 * - urutan halaman duplex harus berpasangan F1,B1,F2,B2… (halaman ganjil =
 *   sisi depan, genap = sisi belakang);
 * - mode gabungan harus menaruh tiap sisi kartu di sel grid sendiri agar
 *   tidak tumpang tindih;
 * - kalibrasi duplex & gabungan disimpan terpisah karena beda fisik:
 *   duplex mengkompensasi pembalikan kertas (nilai lama: belakang +11 mm),
 *   gabungan dicetak satu sisi tanpa pembalikan (nilai lama: −2 mm per blok).
 */

export const ROWS_PER_PAGE = 4;

export interface PrintCell {
  key: string;
  student: StudentCard;
  side: "front" | "back";
  /** Indeks kolom pada baris halaman (0-based), menentukan offset kalibrasi. */
  col: number;
}

export interface PrintPage {
  key: string;
  cells: PrintCell[];
}

export type PrintMode = "combined" | "duplex";

export interface BuildPrintPagesParams {
  cards: StudentCard[];
  cardsPerRow: number;
  mode: PrintMode;
  showBackSide: boolean;
}

/** Susun daftar halaman cetak sesuai mode & jumlah kartu per baris. */
export function buildPrintPages({ cards, cardsPerRow, mode, showBackSide }: BuildPrintPagesParams): PrintPage[] {
  const perRow = Math.max(1, Math.floor(cardsPerRow));
  const cellsPerPage = perRow * ROWS_PER_PAGE;
  const pages: PrintPage[] = [];

  if (mode === "duplex") {
    const studentsPerPage = cellsPerPage;
    for (let start = 0; start < cards.length; start += studentsPerPage) {
      const batch = cards.slice(start, start + studentsPerPage);
      pages.push({
        key: `front-${pages.length}`,
        cells: batch.map((student, i) => ({ key: student.id, student, side: "front" as const, col: i % perRow })),
      });
      if (showBackSide) {
        pages.push({
          key: `back-${pages.length}`,
          cells: batch.map((student, i) => ({ key: student.id, student, side: "back" as const, col: i % perRow })),
        });
      }
    }
    return pages;
  }

  // Mode gabungan: tiap sisi kartu adalah sel grid tersendiri, diurutkan
  // f1,b1,f2,b2… sehingga pada 2 kolom tiap baris berisi pasangan depan+belakang
  // satu siswa — muat di A4 dan tinggal digunting per baris.
  const flat: PrintCell[] = [];
  for (const student of cards) {
    flat.push({ key: `${student.id}-front`, student, side: "front", col: flat.length % perRow });
    if (showBackSide) flat.push({ key: `${student.id}-back`, student, side: "back", col: flat.length % perRow });
  }
  for (let start = 0; start < flat.length; start += cellsPerPage) {
    pages.push({ key: `combined-${pages.length}`, cells: flat.slice(start, start + cellsPerPage) });
  }
  return pages;
}

// ===================== Kalibrasi posisi (offset mm per mode per sisi per kolom) =====================

export interface ColumnOffset {
  x: number;
  y: number;
}

export interface PrintAdjust {
  front: ColumnOffset[];
  back: ColumnOffset[];
}

/** Kalibrasi terpisah per mode cetak — nilai duplex tak boleh tercemar oleh gabungan. */
export interface AdjustAll {
  duplex: PrintAdjust;
  combined: PrintAdjust;
}

/**
 * Default mempertahankan kalibrasi lama:
 * - duplex: depan x = −2 mm (dulu hardcode margin-left halaman depan),
 *   belakang x = 11 mm (default slider kalibrasi untuk kertas yang dibalik);
 * - gabungan: kedua sisi x = −2 mm (dulu seluruh halaman digeser −2 mm,
 *   tanpa pergeseran belakang khusus).
 */
export const DEFAULT_ADJUST: AdjustAll = {
  duplex: {
    front: [
      { x: -2, y: 0 },
      { x: -2, y: 0 },
    ],
    back: [
      { x: 11, y: 0 },
      { x: 11, y: 0 },
    ],
  },
  combined: {
    front: [
      { x: -2, y: 0 },
      { x: -2, y: 0 },
    ],
    back: [
      { x: -2, y: 0 },
      { x: -2, y: 0 },
    ],
  },
};

export function getOffset(adjust: AdjustAll, mode: PrintMode, side: "front" | "back", col: number): ColumnOffset {
  const list = adjust[mode][side];
  const fallback = DEFAULT_ADJUST[mode][side][0];
  return list[col] ?? list[0] ?? fallback;
}

/** Salin adjust lalu set nilai satu sumbu pada (mode, sisi, kolom), melengkapi kolom bila kurang. */
export function withOffset(
  adjust: AdjustAll,
  mode: PrintMode,
  side: "front" | "back",
  col: number,
  axis: "x" | "y",
  value: number
): AdjustAll {
  const target = adjust[mode];
  const list = [...target[side]];
  const base = DEFAULT_ADJUST[mode][side][0];
  while (list.length <= col) list.push({ ...base });
  list[col] = { ...list[col], [axis]: value };
  return { ...adjust, [mode]: { ...target, [side]: list } };
}

// ---- Persistensi localStorage ----

const STORAGE_KEY = "siswa-cetak-kartu-adjust";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function sanitizeSide(value: unknown, fallback: ColumnOffset[]): ColumnOffset[] {
  if (!Array.isArray(value)) return fallback;
  const out: ColumnOffset[] = [];
  for (const item of value) {
    if (item && isFiniteNumber((item as ColumnOffset).x) && isFiniteNumber((item as ColumnOffset).y)) {
      out.push({ x: (item as ColumnOffset).x, y: (item as ColumnOffset).y });
    }
  }
  return out.length > 0 ? out : fallback;
}

function sanitizeAdjust(value: unknown, fallback: PrintAdjust): PrintAdjust {
  const v = (value ?? {}) as Partial<PrintAdjust>;
  return {
    front: sanitizeSide(v.front, fallback.front),
    back: sanitizeSide(v.back, fallback.back),
  };
}

export function normalizeAdjust(value: unknown): AdjustAll {
  const v = (value ?? {}) as Partial<AdjustAll>;
  return {
    duplex: sanitizeAdjust(v.duplex, DEFAULT_ADJUST.duplex),
    combined: sanitizeAdjust(v.combined, DEFAULT_ADJUST.combined),
  };
}

/** Baca pengaturan tersimpan; null bila belum ada / rusak / di luar browser. */
export function readAdjustStorage(): AdjustAll | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeAdjust(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeAdjustStorage(adjust: AdjustAll): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAdjust(adjust)));
  } catch {
    /* storage penuh/di-block — abaikan, nilai tetap hidup di state */
  }
}
