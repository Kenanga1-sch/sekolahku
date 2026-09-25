/**
 * report-xlsx.ts — Microsoft Excel (.xlsx) Generator untuk Report Builder (memakai @e965/xlsx).
 */

import * as XLSX from "@e965/xlsx";
import type { ReportDocumentData } from "@/lib/config/report-document";
import type { ReportColumnConfig } from "@/lib/config/report-blocks";
import { processReportTable, formatCellValue } from "@/lib/report-engine";

export interface ReportXlsxInput {
  document: ReportDocumentData;
  dataset?: Record<string, any>[];
  fileName?: string;
}

export function generateReportXlsx({
  document: doc,
  dataset = [],
  fileName = "Laporan",
}: ReportXlsxInput): void {
  const wb = XLSX.utils.book_new();

  // Temukan blok tabel dinamis dari dokumen
  let rawCols: ReportColumnConfig[] = [];
  let title = doc.reportName || "Laporan";

  for (const p of doc.pages) {
    for (const b of p.blocks) {
      if (b.blockId === "judul_laporan" && b.data?.judul) {
        title = String(b.data.judul);
      }
      if (b.blockId === "tabel_laporan" && Array.isArray(b.data?.columns)) {
        rawCols = b.data.columns;
      }
    }
  }

  if (rawCols.length === 0) {
    rawCols = [
      { key: "no", label: "No", align: "center" },
      { key: "nama", label: "Nama", align: "left" },
    ];
  }

  const tableRes = processReportTable(rawCols, dataset);

  // Susun data worksheet
  const wsData: any[][] = [];

  // 1. Judul Laporan
  wsData.push([title.toUpperCase()]);
  wsData.push([]); // Baris kosong

  // 2. Header Tabel
  const headers = tableRes.columns.map((c) => c.label);
  wsData.push(headers);

  // 3. Baris Data
  tableRes.rows.forEach((r) => {
    const rowVals = tableRes.columns.map((c) => {
      const val = r[c.key];
      if (c.format === "number" || c.format === "rupiah") {
        const num = typeof val === "number" ? val : parseFloat(String(val || 0));
        return isNaN(num) ? 0 : num;
      }
      return formatCellValue(val, c.format);
    });
    wsData.push(rowVals);
  });

  // 4. Baris Total / Auto-Sum
  if (tableRes.hasAutoSum) {
    const footVals = tableRes.columns.map((c, idx) => {
      if (idx === 0) return "TOTAL";
      if (c.autoSum && tableRes.totals[c.key] !== null) {
        return tableRes.totals[c.key];
      }
      return "";
    });
    wsData.push(footVals);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Atur lebar kolom otomatis
  const colWidths = tableRes.columns.map((c) => ({
    wch: Math.max(c.label.length + 4, 12),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Laporan");

  // Unduh file XLSX
  XLSX.writeFile(wb, `${fileName.replace(/\s+/g, "_")}.xlsx`);
}
