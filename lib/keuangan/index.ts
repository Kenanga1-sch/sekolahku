/**
 * Client modul Keuangan (buku besar generik multi-unit usaha).
 *
 * Menampung segala jenis keuangan sekolah: sampah plastik (dijual ke pengepul),
 * koperasi, kantin, dll. Inti: Unit Usaha → Kategori → Transaksi → Saldo.
 * Modul berdiri sendiri; tidak menyentuh brankas/tabungan.
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

// ================= Types =================

export type FinanceDirection = "in" | "out";

export interface FinanceUnit {
  id: string;
  code: string;
  name: string;
  type: "generic" | "sampah" | "koperasi" | "kantin" | "lainnya" | string;
  description: string;
  icon: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  totalIn?: number;
  totalOut?: number;
  balance?: number;
}

export interface FinanceCategory {
  id: string;
  unitId: string;
  unitName?: string;
  name: string;
  direction: FinanceDirection;
  isActive: boolean;
  sortOrder: number;
}

export interface FinanceTransaction {
  id: string;
  unitId: string;
  unitName?: string;
  categoryId?: string;
  categoryName?: string;
  direction: FinanceDirection;
  amount: number;
  description: string;
  txDate: string;
  party: string;
  quantity?: number;
  unitPrice?: number;
  reference: string;
  metadata?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSummary {
  unitId: string;
  unitName: string;
  unitCode: string;
  totalIn: number;
  totalOut: number;
  balance: number;
  txCount: number;
}

export interface FinanceCategoryRecap {
  categoryId: string;
  name: string;
  direction: FinanceDirection;
  total: number;
  txCount: number;
}

export interface FinanceMonthlyRecap {
  period: string;
  totalIn: number;
  totalOut: number;
  net: number;
  txCount: number;
}

export interface FinanceAuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  actorName: string;
  createdAt: string;
}

export interface TransactionFilter {
  unitId?: string;
  categoryId?: string;
  direction?: FinanceDirection | "";
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionInput {
  unitId: string;
  categoryId?: string;
  direction: FinanceDirection;
  amount: number;
  description?: string;
  txDate?: string;
  party?: string;
  quantity?: number | null;
  unitPrice?: number | null;
  reference?: string;
  metadata?: string;
}

// ================= Unit Usaha =================

export async function listUnits(includeInactive = false): Promise<FinanceUnit[]> {
  const q = includeInactive ? "?includeInactive=1" : "";
  const res = await goGet<{ items: FinanceUnit[] }>(`/api/finance/units${q}`, { skipRetry: true });
  return res.items || [];
}

export async function getUnit(idOrCode: string): Promise<FinanceUnit> {
  const res = await goGet<{ data: FinanceUnit }>(`/api/finance/units/${encodeURIComponent(idOrCode)}`, { skipRetry: true });
  return res.data;
}

export async function createUnit(data: Partial<FinanceUnit>): Promise<FinanceUnit> {
  const res = await goPost<{ data: FinanceUnit }>("/api/finance/units", data);
  return res.data;
}

export async function updateUnit(id: string, data: Partial<FinanceUnit>): Promise<void> {
  await goPut(`/api/finance/units/${encodeURIComponent(id)}`, data);
}

export async function deleteUnit(id: string): Promise<void> {
  await goDelete(`/api/finance/units/${encodeURIComponent(id)}`);
}

// ================= Kategori =================

export async function listCategories(unitId?: string, includeInactive = false): Promise<FinanceCategory[]> {
  const q = new URLSearchParams();
  if (unitId) q.set("unitId", unitId);
  if (includeInactive) q.set("includeInactive", "1");
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await goGet<{ items: FinanceCategory[] }>(`/api/finance/categories${qs}`, { skipRetry: true });
  return res.items || [];
}

export async function createCategory(data: Partial<FinanceCategory>): Promise<FinanceCategory> {
  const res = await goPost<{ data: FinanceCategory }>("/api/finance/categories", data);
  return res.data;
}

export async function updateCategory(id: string, data: Partial<FinanceCategory>): Promise<void> {
  await goPut(`/api/finance/categories/${encodeURIComponent(id)}`, data);
}

export async function deleteCategory(id: string): Promise<void> {
  await goDelete(`/api/finance/categories/${encodeURIComponent(id)}`);
}

// ================= Transaksi =================

export async function listTransactions(filter: TransactionFilter = {}): Promise<FinanceTransaction[]> {
  const q = new URLSearchParams();
  if (filter.unitId) q.set("unitId", filter.unitId);
  if (filter.categoryId) q.set("categoryId", filter.categoryId);
  if (filter.direction) q.set("direction", filter.direction);
  if (filter.dateFrom) q.set("dateFrom", filter.dateFrom);
  if (filter.dateTo) q.set("dateTo", filter.dateTo);
  if (filter.search) q.set("search", filter.search);
  if (filter.limit) q.set("limit", String(filter.limit));
  if (filter.offset) q.set("offset", String(filter.offset));
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await goGet<{ items: FinanceTransaction[] }>(`/api/finance/transactions${qs}`, { skipRetry: true });
  return res.items || [];
}

export async function createTransaction(data: TransactionInput): Promise<FinanceTransaction> {
  const res = await goPost<{ data: FinanceTransaction }>("/api/finance/transactions", data);
  return res.data;
}

export async function updateTransaction(id: string, data: TransactionInput): Promise<void> {
  await goPut(`/api/finance/transactions/${encodeURIComponent(id)}`, data);
}

export async function deleteTransaction(id: string): Promise<void> {
  await goDelete(`/api/finance/transactions/${encodeURIComponent(id)}`);
}

// ================= Ringkasan & Rekap =================

export async function getSummary(unitId?: string): Promise<FinanceSummary[]> {
  const q = unitId ? `?unitId=${encodeURIComponent(unitId)}` : "";
  const res = await goGet<{ items: FinanceSummary[]; data?: FinanceSummary }>(`/api/finance/summary${q}`, { skipRetry: true });
  if (res.data) return [res.data];
  return res.items || [];
}

export async function recapByCategory(unitId: string, dateFrom?: string, dateTo?: string): Promise<FinanceCategoryRecap[]> {
  const q = new URLSearchParams({ unitId });
  if (dateFrom) q.set("dateFrom", dateFrom);
  if (dateTo) q.set("dateTo", dateTo);
  const res = await goGet<{ items: FinanceCategoryRecap[] }>(`/api/finance/recap/category?${q.toString()}`, { skipRetry: true });
  return res.items || [];
}

export async function recapMonthly(unitId?: string, limit = 24): Promise<FinanceMonthlyRecap[]> {
  const q = new URLSearchParams();
  if (unitId) q.set("unitId", unitId);
  q.set("limit", String(limit));
  const res = await goGet<{ items: FinanceMonthlyRecap[] }>(`/api/finance/recap/monthly?${q.toString()}`, { skipRetry: true });
  return res.items || [];
}

export async function listAuditLog(limit = 100): Promise<FinanceAuditLog[]> {
  const res = await goGet<{ items: FinanceAuditLog[] }>(`/api/finance/audit?limit=${limit}`, { skipRetry: true });
  return res.items || [];
}

// ================= Fungsi murni (diuji) =================

/** Format Rupiah: 1234567 → "Rp 1.234.567". */
export function formatRupiah(value: number): string {
  if (!Number.isFinite(value)) return "Rp 0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

/** Ringkas format Rupiah (tanpa desimal) untuk saldo besar. */
export function formatRupiahShort(value: number): string {
  if (!Number.isFinite(value)) return "Rp 0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)} jt`;
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} rb`;
  return formatRupiah(value);
}

/** Saldo = masuk − keluar. */
export function computeBalance(totalIn: number, totalOut: number): number {
  const i = Number.isFinite(totalIn) ? totalIn : 0;
  const o = Number.isFinite(totalOut) ? totalOut : 0;
  return Math.round(i) - Math.round(o);
}

/** Total amount = kuantitas × harga satuan (sampah: kg × harga/kg). */
export function computeAmount(quantity: number, unitPrice: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  if (quantity <= 0 || unitPrice <= 0) return 0;
  return Math.round(quantity * unitPrice);
}

/** Label arah transaksi. */
export function directionLabel(direction: FinanceDirection | string): string {
  return direction === "out" ? "Pengeluaran" : "Pemasukan";
}

/** Label jenis unit usaha. */
export function unitTypeLabel(type: string): string {
  const map: Record<string, string> = {
    generic: "Umum",
    sampah: "Pengelolaan Sampah",
    koperasi: "Koperasi",
    kantin: "Kantin",
    lainnya: "Lainnya",
  };
  return map[type] || "Umum";
}

/** Format periode "2025-03" → "Maret 2025". */
export function formatPeriod(period: string): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const idx = parseInt(m[2], 10) - 1;
  if (idx < 0 || idx > 11) return period;
  return `${months[idx]} ${m[1]}`;
}

/** Apakah unit bertipe sampah (memakai form timbangan kg/harga). */
export function isSampahUnit(type: string): boolean {
  return type === "sampah";
}
