import type { UserRole } from "@/types";

/**
 * Role yang boleh mengelola Hari Libur.
 *
 * Satu sumber kebenangan untuk semua pintu masuk: tab "Hari Libur" di
 * /presensi, halaman mandiri /presensi/holidays, dan quick action "Kelola
 * Libur" di dashboard presensi. Backend /api/school-holidays juga sudah
 * admin-only (adminGroup di routes.go).
 */
export const HARI_LIBUR_ROLES: UserRole[] = ["admin", "superadmin"];

export function canManageHolidays(role?: UserRole | string | null): boolean {
  return role === "admin" || role === "superadmin";
}
