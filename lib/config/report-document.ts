/**
 * report-document.ts — Model dokumen format laporan modular.
 */

import { createReportBlockInstance, type ReportBlockInstance } from "@/lib/config/report-blocks";

export type ReportPaperSize = "A4" | "F4" | "LEGAL";
export type ReportOrientation = "portrait" | "landscape";

export interface ReportPage {
  id: string;
  name: string;
  blocks: ReportBlockInstance[];
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
  pages: ReportPage[];
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
    schemaVersion: 1,
    reportCode: opts?.reportCode || "RPT_CUSTOM",
    reportName: opts?.reportName || "Laporan Custom",
    category: opts?.category || "Umum",
    paperSize: "A4",
    orientation: "portrait",
    showFooter: true,
    pages: [
      {
        id: "p1",
        name: "Laporan Utama",
        blocks,
        useHeader: true,
      },
    ],
  };
}

export function serializeReportDocument(doc: ReportDocumentData): string {
  return JSON.stringify(doc);
}

export function deserializeReportDocument(jsonStr: string): ReportDocumentData {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.pages)) {
      return parsed as ReportDocumentData;
    }
  } catch {
    /* ignore */
  }
  return createDefaultReportDocument();
}
