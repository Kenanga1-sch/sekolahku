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

/** Dokumen surat modular penuh. */
export interface LetterDocumentData {
  /** Versi skema (untuk migrasi ke depan). */
  schemaVersion: number;
  letterTypeId: number | null;
  jenisSurat?: string;
  standardCategory?: string;
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
  meta?: { letterTypeId?: number | null; jenisSurat?: string; standardCategory?: string }
): LetterDocumentData {
  const category = meta?.standardCategory || "lainnya";
  const all = buildDefaultBlocksForCategory(blockIds, category);
  const pages = splitBlocksIntoPages(all);
  return {
    schemaVersion: LETTER_DOCUMENT_SCHEMA_VERSION,
    letterTypeId: meta?.letterTypeId ?? null,
    jenisSurat: meta?.jenisSurat,
    standardCategory: meta?.standardCategory,
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
