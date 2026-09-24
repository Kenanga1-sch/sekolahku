/**
 * letter-document.ts — Model dokumen surat modular multi-halaman.
 *
 * Model eksplisit: sebuah surat terdiri dari satu atau lebih "halaman"
 * (LetterPage), masing-masing punya susunan blok sendiri. Ini mendukung:
 *  - surat multi-halaman (mis. surat + lampiran daftar hadir),
 *  - kop berulang / kop hanya di halaman pertama,
 *  - halaman lampiran terpisah.
 *
 * Backward-compatibility:
 *  - Surat lama menyimpan contentBlocks = { letterTypeId, jenisSurat,
 *    standardCategory, blocks: LetterBlockInstance[] } (satu halaman).
 *  - migrateContentBlocksToDocument() membungkusnya menjadi LetterDocument
 *    satu halaman agar tetap bisa dibuka & diedit.
 */

import {
  buildDefaultBlocksForCategory,
  createBlockInstance,
  type LetterBlockInstance,
} from "@/lib/config/letter-blocks";

/** Satu halaman dalam dokumen surat. */
export interface LetterPage {
  /** Instance id unik halaman. */
  id: string;
  /** Nama halaman (mis. "Surat Utama", "Lampiran"). */
  name: string;
  /** Blok pada halaman ini. */
  blocks: LetterBlockInstance[];
  /**
   * Tampilkan kop surat di halaman ini.
   * Umumnya true untuk halaman pertama, false untuk lampiran.
   */
  useHeader?: boolean;
}

/** Ukuran kertas yang didukung (mirror halaman cetak klasik). */
export type LetterPaperSize = "A4" | "F4" | "LEGAL";
export type LetterOrientation = "portrait" | "landscape";

/** Opsi ukuran kertas untuk UI. */
export const LETTER_PAPER_OPTIONS: { value: LetterPaperSize; label: string; mm: [number, number] }[] = [
  { value: "A4", label: "A4 (210 × 297 mm)", mm: [210, 297] },
  { value: "F4", label: "F4 / Folio (215 × 330 mm)", mm: [215, 330] },
  { value: "LEGAL", label: "Legal (216 × 356 mm)", mm: [216, 356] },
];

/** Dokumen surat modular penuh. */
export interface LetterDocumentData {
  /** Versi skema (untuk migrasi ke depan). */
  schemaVersion: number;
  letterTypeId: number | null;
  jenisSurat?: string;
  standardCategory?: string;
  /** Ukuran kertas dokumen (default A4). */
  paperSize?: LetterPaperSize;
  /** Orientasi halaman (default portrait). */
  orientation?: LetterOrientation;
  /** Tampilkan nomor halaman di footer. */
  showFooter?: boolean;
  /** Teks watermark (opsional). */
  watermark?: string;
  pages: LetterPage[];
}

/** Versi skema dokumen saat ini. */
export const LETTER_DOCUMENT_SCHEMA_VERSION = 2;

let pageCounter = 0;

/** Membuat id halaman unik. */
export function newPageId(): string {
  pageCounter += 1;
  return `page-${Date.now().toString(36)}-${pageCounter}`;
}

/** Membuat halaman baru yang kosong. */
export function createPage(name = "Halaman Baru", blocks: LetterBlockInstance[] = []): LetterPage {
  return { id: newPageId(), name, blocks, useHeader: false };
}

/**
 * Membuat dokumen default dari daftar id blok standar (satu halaman).
 * Blok `page_break` pada default dipakai sebagai penanda pemisah halaman.
 */
export function createDocumentFromBlocks(
  blockIds: string[],
  meta?: {
    letterTypeId?: number | null;
    jenisSurat?: string;
    standardCategory?: string;
    paperSize?: LetterPaperSize;
    orientation?: LetterOrientation;
  }
): LetterDocumentData {
  const category = meta?.standardCategory || "lainnya";
  const all = buildDefaultBlocksForCategory(blockIds, category);
  const pages = splitBlocksIntoPages(all);
  return {
    schemaVersion: LETTER_DOCUMENT_SCHEMA_VERSION,
    letterTypeId: meta?.letterTypeId ?? null,
    jenisSurat: meta?.jenisSurat,
    standardCategory: meta?.standardCategory,
    paperSize: meta?.paperSize ?? "A4",
    orientation: meta?.orientation ?? "portrait",
    showFooter: true,
    watermark: "",
    pages,
  };
}

/**
 * Memisahkan daftar blok menjadi beberapa halaman berdasarkan blok `page_break`.
 * Blok page_break tidak ikut disimpan ke dalam halaman (hanya penanda pisah).
 */
export function splitBlocksIntoPages(blocks: LetterBlockInstance[]): LetterPage[] {
  const pages: LetterPage[] = [];
  let current: LetterBlockInstance[] = [];
  const first = createPage("Surat Utama");
  first.useHeader = true;

  for (const b of blocks) {
    if (b.blockId === "page_break") {
      pages.push({ ...first, id: newPageId(), blocks: current });
      current = [];
      continue;
    }
    current.push(b);
  }
  // Halaman terakhir.
  const last: LetterPage = {
    id: newPageId(),
    name: pages.length === 0 ? "Surat Utama" : `Halaman ${pages.length + 1}`,
    blocks: current,
    useHeader: pages.length === 0,
  };
  pages.push(last);
  return pages;

}

/**
 * Migrasi contentBlocks (string JSON) lama/baru menjadi LetterDocumentData.
 * Menerima:
 *  - struktur lama { blocks: [...] }
 *  - struktur baru { pages: [...] }
 *  - null/undefined → dokumen kosong satu halaman.
 */
export function migrateContentBlocksToDocument(
  raw: string | null | undefined
): LetterDocumentData {
  const empty: LetterDocumentData = {
    schemaVersion: LETTER_DOCUMENT_SCHEMA_VERSION,
    letterTypeId: null,
    paperSize: "A4",
    orientation: "portrait",
    showFooter: true,
    watermark: "",
    pages: [createPage("Surat Utama", [])],
  };
  if (!raw) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;
  const obj = parsed as Record<string, unknown>;

  /** Ambil nilai paper size & orientasi yang valid. */
  const paperSize =
    obj.paperSize === "A4" || obj.paperSize === "F4" || obj.paperSize === "LEGAL"
      ? (obj.paperSize as LetterPaperSize)
      : "A4";
  const orientation = obj.orientation === "landscape" ? "landscape" : "portrait";
  const showFooter = obj.showFooter !== false;
  const watermark =
    typeof obj.watermark === "string" ? obj.watermark : "";

  // Struktur baru.
  if (Array.isArray(obj.pages)) {
    const pages = (obj.pages as unknown[])
      .map((p) => normalizePage(p))
      .filter((p): p is LetterPage => p !== null);
    return {
      schemaVersion: LETTER_DOCUMENT_SCHEMA_VERSION,
      letterTypeId: typeof obj.letterTypeId === "number" ? obj.letterTypeId : null,
      jenisSurat: typeof obj.jenisSurat === "string" ? obj.jenisSurat : undefined,
      standardCategory:
        typeof obj.standardCategory === "string" ? obj.standardCategory : undefined,
      paperSize,
      orientation,
      showFooter,
      watermark,
      pages: pages.length > 0 ? pages : empty.pages,
    };
  }

  // Struktur lama: { blocks: [...] }.
  if (Array.isArray(obj.blocks)) {
    const blocks = (obj.blocks as unknown[])
      .map((b) => normalizeBlock(b))
      .filter((b): b is LetterBlockInstance => b !== null);
    const pages = splitBlocksIntoPages(blocks);
    return {
      schemaVersion: LETTER_DOCUMENT_SCHEMA_VERSION,
      letterTypeId: typeof obj.letterTypeId === "number" ? obj.letterTypeId : null,
      jenisSurat: typeof obj.jenisSurat === "string" ? obj.jenisSurat : undefined,
      standardCategory:
        typeof obj.standardCategory === "string" ? obj.standardCategory : undefined,
      paperSize,
      orientation,
      showFooter,
      watermark,
      pages,
    };
  }

  return empty;
}

function normalizeBlock(raw: unknown): LetterBlockInstance | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const blockId = typeof o.blockId === "string" ? o.blockId : "";
  if (!blockId) return null;
  const data =
    o.data && typeof o.data === "object"
      ? (o.data as Record<string, unknown>)
      : {};
  return {
    instanceId:
      typeof o.instanceId === "string" && o.instanceId
        ? o.instanceId
        : createBlockInstance(blockId)?.instanceId ?? `${blockId}-mig`,
    blockId,
    enabled: o.enabled !== false,
    data: data as LetterBlockInstance["data"],
  };
}

function normalizePage(raw: unknown): LetterPage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const blocks = Array.isArray(o.blocks)
    ? (o.blocks as unknown[]).map((b) => normalizeBlock(b)).filter((b): b is LetterBlockInstance => b !== null)
    : [];
  return {
    id: typeof o.id === "string" && o.id ? o.id : newPageId(),
    name: typeof o.name === "string" && o.name ? o.name : "Halaman",
    blocks,
    useHeader: o.useHeader === true,
  };
}

/** Serialisasi dokumen untuk disimpan ke kolom contentBlocks. */
export function serializeDocument(doc: LetterDocumentData): string {
  return JSON.stringify({ ...doc, schemaVersion: LETTER_DOCUMENT_SCHEMA_VERSION });
}

/** Total blok di seluruh halaman (untuk penanda jumlah di UI). */
export function countBlocks(doc: LetterDocumentData): number {
  return doc.pages.reduce((sum, p) => sum + p.blocks.length, 0);
}

/**
 * Mengambil dimensi kertas dalam pt (1mm = 2.83465pt), disesuaikan orientasi.
 * Memberikan [width, height] untuk renderer PDF (Page size) & CSS @page.
 */
export function getPaperSizePt(
  paperSize: LetterPaperSize | undefined,
  orientation: LetterOrientation | undefined
): [number, number] {
  const opt = LETTER_PAPER_OPTIONS.find((o) => o.value === (paperSize ?? "A4")) ??
    LETTER_PAPER_OPTIONS[0];
  const [w, h] = opt.mm;
  // mm → pt.
  const wPt = w * 2.83465;
  const hPt = h * 2.83465;
  return orientation === "landscape" ? [hPt, wPt] : [wPt, hPt];
}

/**
 * Mengambil aturan CSS @page size untuk renderer HTML cetak.
 * Contoh: "A4 portrait" atau "215mm 330mm landscape".
 */
export function getPaperCss(
  paperSize: LetterPaperSize | undefined,
  orientation: LetterOrientation | undefined
): string {
  const ps = paperSize ?? "A4";
  const or = orientation === "landscape" ? "landscape" : "portrait";
  if (ps === "LEGAL") return `legal ${or}`;
  if (ps === "F4") return `215mm 330mm ${or}`;
  return `A4 ${or}`;
}
