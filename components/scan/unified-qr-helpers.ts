// Konstanta & helper murni untuk Unified QR Workbench (scan presensi & tabungan).
// Dipisah dari komponen agar dapat diuji tanpa merender UI.

import type { TabunganSiswaWithRelations } from "@/types/tabungan";

export const SAME_CODE_BLOCK_MS = 3000;
export const RESET_AFTER_ACTION_MS = 2500;
export const INVALID_RESET_MS = 3000;
export const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

export type AttendanceStatus =
  | "recorded"
  | "already"
  | "wrong-class"
  | "no-session"
  | "not-found"
  | "error";

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function toArray<T>(response: unknown): T[] {
  const value = response as { data?: T[]; items?: T[] } | T[] | null | undefined;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

export function getApiMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

export function getApiData(error: unknown): Record<string, unknown> | undefined {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    return data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;
  }
  return undefined;
}

export function getSavingsName(account: TabunganSiswaWithRelations | null): string {
  return account?.nama || "Penabung";
}

export function getSavingsClass(account: TabunganSiswaWithRelations | null): string | undefined {
  return account?.kelas?.nama || account?.kelasId;
}

export function attendanceBadgeClass(status: AttendanceStatus): string {
  switch (status) {
    case "recorded":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300";
    case "already":
      return "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300";
    case "wrong-class":
    case "no-session":
      return "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300";
    default:
      return "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300";
  }
}
