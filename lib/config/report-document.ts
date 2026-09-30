/**
 * report-document.ts — Model dokumen format laporan modular.
 */

import { createReportBlockInstance, type ReportBlockInstance } from "@/lib/config/report-blocks";

export type ReportPaperSize = "A4" | "F4" | "LEGAL";
export type ReportOrientation = "portrait" | "landscape";
export type ReportDensity = "normal" | "padat" | "sangat_padat";

export const REPORT_SCHEMA_VERSION = 2;

export interface ReportMarginConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ReportDensityConfig {
  baseFontSize: number;
  tableFontSize: number;
  lineHeight: number;
  rowPadding: number;
  blockGap: number;
}

/**
 * Kolom di dalam satu baris halaman. Satu halaman bisa dibagi menjadi
 * beberapa kolom berdampingan (mis. 2 tabel side-by-side).
 */
export interface ReportColumnSlot {
  id: string;
  widthPct: number; // lebar relatif terhadap baris (total ~100)
  blocks: ReportBlockInstance[];
}

/**
 * Satu baris halaman berisi 1..N kolom. Menggantikan `blocks[]` datar
 * pada schema v1.
 */
export interface ReportRow {
  id: string;
  columns: ReportColumnSlot[];
}

export interface ReportPage {
  id: string;
  name: string;
  rows: ReportRow[];
  useHeader?: boolean;
}

export interface ReportDocumentData {
  schemaVersion: number;
  reportCode?: string;
  reportName?: string;
  category?: string;
  paperSize: ReportPaperSize;
  orientation: ReportOrientation;
  showFooter: boolean;
  density: ReportDensity;
  margin: ReportMarginConfig;
  typography: ReportDensityConfig;
  headerRepeat: boolean;
  pages: ReportPage[];
}

export const REPORT_DENSITY_PRESETS: Record<ReportDensity, { label: string; margin: ReportMarginConfig; typography: ReportDensityConfig }> = {
  normal: {
    label: "Normal",
    margin: { top: 36, bottom: 45, left: 40, right: 40 },
    typography: { baseFontSize: 11, tableFontSize: 11, lineHeight: 1.4, rowPadding: 4, blockGap: 8 },
  },
  padat: {
    label: "Padat",
    margin: { top: 24, bottom: 28, left: 24, right: 24 },
    typography: { baseFontSize: 11, tableFontSize: 11, lineHeight: 1.25, rowPadding: 2.5, blockGap: 6 },
  },
  sangat_padat: {
    label: "Sangat Padat",
    margin: { top: 16, bottom: 18, left: 16, right: 16 },
    typography: { baseFontSize: 11, tableFontSize: 11, lineHeight: 1.1, rowPadding: 1.5, blockGap: 4 },
  },
};

export function defaultMargin(): ReportMarginConfig {
  return { ...REPORT_DENSITY_PRESETS.normal.margin };
}

export function defaultTypography(): ReportDensityConfig {
  return { ...REPORT_DENSITY_PRESETS.normal.typography };
}

let slotCounter = 0;
export function createRowId(): string {
  slotCounter += 1;
  return `row-${Date.now().toString(36)}-${slotCounter}`;
}

export function createColumnSlot(blocks: ReportBlockInstance[] = [], widthPct = 100): ReportColumnSlot {
  slotCounter += 1;
  return {
    id: `col-${Date.now().toString(36)}-${slotCounter}`,
    widthPct,
    blocks,
  };
}

export function createDefaultReportDocument(opts?: {
  reportCode?: string;
  reportName?: string;
  category?: string;
}): ReportDocumentData {
  const blocks: ReportBlockInstance[] = [
    createReportBlockInstance("kop_laporan")!,
    createReportBlockInstance("judul_laporan")!,
    createReportBlockInstance("ringkasan_kpi")!,
    createReportBlockInstance("tabel_laporan")!,
    createReportBlockInstance("tanda_tangan")!,
  ].filter(Boolean);

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    reportCode: opts?.reportCode || "RPT_CUSTOM",
    reportName: opts?.reportName || "Laporan Custom",
    category: opts?.category || "Umum",
    paperSize: "A4",
    orientation: "portrait",
    showFooter: true,
    density: "normal",
    margin: defaultMargin(),
    typography: defaultTypography(),
    headerRepeat: true,
    pages: [
      {
        id: "p1",
        name: "Laporan Utama",
        rows: [{ id: createRowId(), columns: [createColumnSlot(blocks, 100)] }],
        useHeader: true,
      },
    ],
  };
}

/** Kumpulkan semua blok dari seluruh halaman (flat). */
export function collectPageBlocks(page: ReportPage | undefined): ReportBlockInstance[] {
  if (!page) return [];
  const out: ReportBlockInstance[] = [];
  for (const row of page.rows || []) {
    for (const col of row.columns || []) {
      out.push(...(col.blocks || []));
    }
  }
  return out;
}

/**
 * Migrasi dokumen dari schema lama. Schema v1 menyimpan `blocks[]` datar di
 * halaman; v2 memakai `rows[].columns[].blocks[]`.
 */
export function migrateReportDocument(doc: any): ReportDocumentData {
  const base = createDefaultReportDocument();
  if (!doc || typeof doc !== "object") return base;

  const migrated: ReportDocumentData = {
    ...base,
    ...doc,
    schemaVersion: REPORT_SCHEMA_VERSION,
    density: doc.density || "normal",
    margin: { ...base.margin, ...(doc.margin || {}) },
    typography: { ...base.typography, ...(doc.typography || {}) },
    headerRepeat: typeof doc.headerRepeat === "boolean" ? doc.headerRepeat : true,
    pages: [],
  };

  const rawPages: any[] = Array.isArray(doc.pages) ? doc.pages : [];
  migrated.pages = rawPages.map((p: any, idx: number) => {
    const pageId = p?.id || `p${idx + 1}`;
    const pageName = p?.name || `Halaman ${idx + 1}`;
    const useHeader = p?.useHeader;

    // Schema v2 sudah punya rows.
    if (Array.isArray(p?.rows)) {
      return {
        id: pageId,
        name: pageName,
        useHeader,
        rows: p.rows.map((r: any) => ({
          id: r?.id || createRowId(),
          columns: Array.isArray(r?.columns)
            ? r.columns.map((c: any) => ({
                id: c?.id || createColumnSlot().id,
                widthPct: typeof c?.widthPct === "number" ? c.widthPct : 100,
                blocks: Array.isArray(c?.blocks) ? c.blocks : [],
              }))
            : [createColumnSlot([], 100)],
        })),
      };
    }

    // Schema v1: blocks[] datar → bungkus menjadi 1 baris 1 kolom.
    const legacyBlocks: ReportBlockInstance[] = Array.isArray(p?.blocks) ? p.blocks : [];
    return {
      id: pageId,
      name: pageName,
      useHeader,
      rows: [{ id: createRowId(), columns: [createColumnSlot(legacyBlocks, 100)] }],
    };
  });

  if (migrated.pages.length === 0) {
    migrated.pages = base.pages;
  }
  return migrated;
}

export function serializeReportDocument(doc: ReportDocumentData): string {
  return JSON.stringify(doc);
}

export function deserializeReportDocument(jsonStr: string): ReportDocumentData {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.pages)) {
      return migrateReportDocument(parsed);
    }
  } catch {
    /* ignore */
  }
  return createDefaultReportDocument();
}
