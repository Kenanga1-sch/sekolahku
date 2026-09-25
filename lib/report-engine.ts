/**
 * report-engine.ts — Data Injector Engine untuk Laporan Generik.
 * Memetakan array JSON mentah ke dalam kolom tabel & menghitung Auto-Sum / KPI.
 */

import type { ReportColumnConfig, ReportKPIItemConfig } from "@/lib/config/report-blocks";

export interface ProcessedReportTable {
  columns: ReportColumnConfig[];
  rows: Record<string, any>[];
  totals: Record<string, number | null>; // Nilai total untuk kolom yang autoSum = true
  hasAutoSum: boolean;
}

export interface ProcessedReportKPI {
  items: { label: string; value: string }[];
}

/** Format angka ke Rupiah "Rp 1.500.000" */
export function formatRupiah(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "Rp 0";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/** Format angka umum dengan titik ribuan "1,500" */
export function formatNumber(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "0";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("id-ID").format(num);
}

/** Format tanggal ke Bahasa Indonesia "25 September 2026" */
export function formatDateIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const bulan = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Format nilai cell berdasarkan konfigurasi kolom.
 */
export function formatCellValue(val: any, format?: ReportColumnConfig["format"]): string {
  if (val === null || val === undefined) return "-";
  if (format === "rupiah") return formatRupiah(val);
  if (format === "number") return formatNumber(val);
  if (format === "date") return formatDateIndo(String(val));
  return String(val);
}

/**
 * Memproses dataset array JSON mentah menjadi struktur tabel dengan kalkulasi Auto-Sum.
 */
export function processReportTable(
  columns: ReportColumnConfig[],
  dataset: Record<string, any>[]
): ProcessedReportTable {
  const totals: Record<string, number | null> = {};
  let hasAutoSum = false;

  // Inisialisasi total untuk kolom yang autoSum = true
  for (const col of columns) {
    if (col.autoSum) {
      totals[col.key] = 0;
      hasAutoSum = true;
    } else {
      totals[col.key] = null;
    }
  }

  // Isi baris dan hitung sum
  const rows = dataset.map((row, idx) => {
    const processedRow: Record<string, any> = { ...row };
    // Jika kolom "no" belum ada di data, buat otomatis berdasarkan indeks
    if (!processedRow.no && !processedRow.No) {
      processedRow.no = idx + 1;
    }

    for (const col of columns) {
      if (col.autoSum) {
        const rawVal = row[col.key];
        const num = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal || 0));
        if (!isNaN(num)) {
          totals[col.key] = (totals[col.key] || 0) + num;
        }
      }
    }
    return processedRow;
  });

  return { columns, rows, totals, hasAutoSum };
}

/**
 * Memproses ringkasan KPI berdasarkan dataset dan konfigurasi item KPI.
 */
export function processReportKPI(
  kpiItems: ReportKPIItemConfig[],
  dataset: Record<string, any>[],
  extraSummary?: Record<string, number | string>
): ProcessedReportKPI {
  const result: { label: string; value: string }[] = [];

  for (const item of kpiItems) {
    let rawVal: any = undefined;

    // 1. Cek dari extraSummary jika ada (misal total_items, total_setoran dari backend)
    if (extraSummary && extraSummary[item.key] !== undefined) {
      rawVal = extraSummary[item.key];
    }
    // 2. Jika key adalah "total_items", hitung jumlah baris dataset
    else if (item.key === "total_items" || item.key === "total_rows") {
      rawVal = dataset.length;
    }
    // 3. Hitung auto-sum dari dataset jika key cocok dengan atribut di dataset
    else {
      let sum = 0;
      let found = false;
      for (const row of dataset) {
        if (row[item.key] !== undefined) {
          const num = typeof row[item.key] === "number" ? row[item.key] : parseFloat(String(row[item.key]));
          if (!isNaN(num)) {
            sum += num;
            found = true;
          }
        }
      }
      if (found) rawVal = sum;
    }

    // Format nilai hasil
    let formatted = "-";
    if (rawVal !== undefined) {
      if (item.format === "rupiah") formatted = formatRupiah(rawVal);
      else if (item.format === "number") formatted = formatNumber(rawVal);
      else formatted = String(rawVal);
    }

    result.push({ label: item.label, value: formatted });
  }

  return { items: result };
}
