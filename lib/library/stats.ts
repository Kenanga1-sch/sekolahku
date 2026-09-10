/**
 * stats — Client-side data fetcher for Library Statistics
 */

import { goGet } from "@/lib/api-client";
import type { LibraryStats } from "@/types/library";

export async function getLibraryStats(): Promise<LibraryStats | null> {
  try {
    const res: any = await goGet("/api/library/stats");
    return res.success ? res.data : null;
  } catch (error) {
    console.error("Failed to fetch library stats:", error);
    return null;
  }
}

/** Batas atas `limit` yang diterima backend untuk laporan (library_report_repo). */
const REPORT_MAX_LIMIT = 5000;

export interface ReportResult<T> {
  items: T[];
  totalItems: number;
  /** True bila data terpotong oleh batas backend. */
  terpotong: boolean;
}

/**
 * Ambil laporan dengan menelusuri halaman bila perlu.
 *
 * Backend memotong hasil sesuai `limit`. Bila total sebenarnya lebih banyak,
 * fungsi ini meminta halaman berikutnya (memakai rentang tanggal yang sama)
 * sampai semua terkumpul atau batas halaman tercapai.
 *
 * Bila tetap terpotong, `terpotong` bernilai true — supaya antarmuka bisa
 * memperingatkan bahwa angka ringkasan TIDAK mencakup seluruh data. Dulu
 * laporan hanya mengambil halaman pertama dan menulis "Total: 1000" seolah
 * itu seluruhnya.
 */
async function fetchReportPage<T>(
  type: string,
  startDate: string,
  endDate: string,
  page: number,
): Promise<{ items: T[]; totalItems: number }> {
  const params = new URLSearchParams({ type, startDate, endDate, limit: String(REPORT_MAX_LIMIT) });
  if (page > 1) params.set("page", String(page));

  const res: any = await goGet(`/api/library/reports?${params}`);
  if (res?.error) throw new Error(res.error);

  // Backend lama mengembalikan array mentah; yang baru membungkusnya.
  const items: T[] = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  const totalItems: number = typeof res?.totalItems === "number" ? res.totalItems : items.length;
  return { items, totalItems };
}

export async function getLoanReport(
  startDate?: string,
  endDate?: string,
): Promise<ReportResult<any>> {
  const first = await fetchReportPage<any>("loan", startDate || "", endDate || "", 1);
  let items = first.items;
  const { totalItems } = first;

  let page = 2;
  while (items.length < totalItems && page <= 20) {
    const next = await fetchReportPage<any>("loan", startDate || "", endDate || "", page);
    if (next.items.length === 0) break;
    items = items.concat(next.items);
    page += 1;
  }

  return { items, totalItems, terpotong: items.length < totalItems };
}

export async function getVisitReport(
  startDate?: string,
  endDate?: string,
): Promise<ReportResult<any>> {
  const first = await fetchReportPage<any>("visit", startDate || "", endDate || "", 1);
  let items = first.items;
  const { totalItems } = first;

  let page = 2;
  while (items.length < totalItems && page <= 20) {
    const next = await fetchReportPage<any>("visit", startDate || "", endDate || "", page);
    if (next.items.length === 0) break;
    items = items.concat(next.items);
    page += 1;
  }

  return { items, totalItems, terpotong: items.length < totalItems };
}

/**
 * Laporan keterlambatan kini diambil SELURUHNYA oleh backend (menelusuri
 * halaman di sana), jadi cukup satu permintaan.
 */
export async function getOverdueReport(): Promise<ReportResult<any>> {
  const res: any = await goGet("/api/library/reports?type=overdue");
  if (res?.error) throw new Error(res.error);
  const items: any[] = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  const totalItems: number = typeof res?.totalItems === "number" ? res.totalItems : items.length;
  return { items, totalItems, terpotong: items.length < totalItems };
}

export async function getRecentActivity() {
  return await goGet("/api/library/activity");
}

export async function getLoanTrend() {
  return await goGet("/api/library/reports/trends");
}

export async function getCategoryDistribution() {
  return await goGet("/api/library/reports/categories");
}
