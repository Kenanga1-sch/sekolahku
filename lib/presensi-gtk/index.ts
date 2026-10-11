/**
 * Modul Presensi GTK (perbaikan 000084).
 *
 * Presensi GTK hanya untuk honorer: GTT, GTY, Honorer, PTT, dan Pembina Ekskul.
 * PNS/PPPK/P3K dikecualikan. Presensi via scan QR divalidasi radius lokasi
 * (titik presensi + haversine di backend).
 *
 * Berisi: tipe data, klien API, dan helper murni (mudah diuji).
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

// ==========================================================================
// Types
// ==========================================================================

export type AttendancePointType = "sekolah" | "ekskul" | "custom";

export interface AttendancePoint {
  id: string;
  name: string;
  pointType: AttendancePointType;
  refId?: string | null;
  latitude: number;
  longitude: number;
  radiusM: number;
  isActive: boolean;
}

export interface EkskulTeacher {
  id: string;
  employeeId: string;
  name: string;
  nip?: string | null;
  extracurricularName: string;
  schedule?: string | null;
  pointId?: string | null;
  pointName?: string | null;
  isActive: boolean;
}

export interface GtkAttendanceRow {
  employeeId: string;
  name: string;
  category: string;
  nip: string;
  employmentStatus: string;
  date: string;
  status: string;
  checkIn: string;
  attendeeType: string;
  distanceM?: number | null;
  withinRadius?: boolean | null;
  pointName?: string;
  extracurricularName?: string;
}

export interface ScanGtkResult {
  already: boolean;
  employee?: { name?: string; category?: string };
  location?: { distanceM?: number; withinRadius?: boolean; pointName?: string };
  message?: string;
}

export interface ScanGtkPayload {
  qrCode: string;
  status?: string;
  recordedBy?: string;
  latitude?: number;
  longitude?: number;
  pointId?: string;
  extracurricularId?: string;
  overrideRadius?: boolean;
  overrideReason?: string;
}

// ==========================================================================
// API client
// ==========================================================================

export const gtkAttendanceApi = {
  scan: (payload: ScanGtkPayload) =>
    goPost<{ success: boolean } & ScanGtkResult>("/api/gtk-attendance/scan", payload, { skipRetry: true }),
  daily: (date: string) => goGet<{ data: GtkAttendanceRow[] }>(`/api/gtk-attendance/daily?date=${encodeURIComponent(date)}`),
  report: (start: string, end: string) =>
    goGet<{ data: GtkAttendanceRow[] }>(`/api/gtk-attendance/report?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  ekskulDaily: (date: string) => goGet<{ data: GtkAttendanceRow[] }>(`/api/gtk-attendance/ekskul?date=${encodeURIComponent(date)}`),
};

export const attendancePointsApi = {
  list: () => goGet<{ data: AttendancePoint[] }>("/api/attendance/points"),
  create: (payload: Partial<AttendancePoint>) => goPost<{ success: boolean; id: string }>("/api/attendance/points", payload),
  update: (id: string, payload: Partial<AttendancePoint>) => goPut<{ success: boolean }>(`/api/attendance/points/${id}`, payload),
  remove: (id: string) => goDelete<{ success: boolean }>(`/api/attendance/points/${id}`),
};

export const ekskulTeachersApi = {
  list: () => goGet<{ data: EkskulTeacher[] }>("/api/attendance/ekskul-teachers"),
  assign: (payload: {
    employeeId: string;
    extracurricularName: string;
    schedule?: string;
    pointId?: string;
    isActive?: boolean;
  }) => goPost<{ success: boolean; id: string }>("/api/attendance/ekskul-teachers", payload),
  update: (id: string, payload: Partial<EkskulTeacher>) => goPut<{ success: boolean }>(`/api/attendance/ekskul-teachers/${id}`, payload),
  remove: (id: string) => goDelete<{ success: boolean }>(`/api/attendance/ekskul-teachers/${id}`),
};

// ==========================================================================
// Helpers murni
// ==========================================================================

/** Status kepegawaian yang WAJIB presensi (mirror backend IsAttendanceRequired). */
export const ATTENDANCE_REQUIRED_STATUSES = ["GTT", "GTY", "Honorer", "PTT", "Pembina Ekskul"] as const;

/** Status ASN yang dikecualikan dari presensi. */
export const ATTENDANCE_EXCLUDED_STATUSES = ["PNS", "P3K", "PPPK", "PPPK PW"] as const;

/**
 * Apakah status kepegawaian wajib presensi. Case-insensitive + trim — nilai
 * lama tak konsisten (P3K vs PPPK).
 */
export function isAttendanceRequired(status?: string | null): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return (
    s === "gtt" ||
    s === "gty" ||
    s === "ptt" ||
    s === "honorer" ||
    s === "guru tidak tetap" ||
    s === "guru tetap yayasan" ||
    s === "pegawai tidak tetap" ||
    s === "pembina ekskul" ||
    s === "pembina ekstrakurikuler"
  );
}

/** Apakah status tergolong ASN (dikecualikan presensi). */
export function isAsn(status?: string | null): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return s === "pns" || s === "p3k" || s === "pppk" || s === "pppk pw";
}

/** Label status presensi GTK + kelas warna tailwind. */
export function gtkStatusLabel(status: string): { text: string; className: string } {
  switch ((status || "").toLowerCase()) {
    case "hadir":
      return { text: "Hadir", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "sakit":
      return { text: "Sakit", className: "bg-sky-50 text-sky-700 border-sky-200" };
    case "izin":
      return { text: "Izin", className: "bg-amber-50 text-amber-700 border-amber-200" };
    case "alpha":
      return { text: "Alpha", className: "bg-rose-50 text-rose-700 border-rose-200" };
    default:
      return { text: "Belum absen", className: "bg-slate-50 text-slate-500 border-slate-200" };
  }
}

/** Format jarak meter → string ringkas ("12 m" / "1.2 km"). */
export function formatDistance(meters?: number | null): string {
  if (meters == null || Number.isNaN(meters)) return "-";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Tentukan titik presensi efektif untuk satu sesi: titik eksplisit → titik
 * ekskul → titik sekolah (default). Mengembalikan titik atau null bila tak ada.
 */
export function resolvePointForSession(
  points: AttendancePoint[],
  opts: { pointId?: string | null; ekskulPointId?: string | null }
): AttendancePoint | null {
  if (opts.pointId) {
    const p = points.find((x) => x.id === opts.pointId);
    if (p) return p;
  }
  if (opts.ekskulPointId) {
    const p = points.find((x) => x.id === opts.ekskulPointId);
    if (p) return p;
  }
  return points.find((p) => p.pointType === "sekolah" && p.isActive) || points.find((p) => p.isActive) || null;
}

/** Label kategori GTK. */
export function gtkCategoryLabel(category?: string): string {
  switch (category) {
    case "kepsek":
      return "Kepala Sekolah";
    case "guru":
      return "Guru";
    case "staff":
      return "Staff TU";
    case "support":
      return "Tenaga Support";
    default:
      return "GTK";
  }
}
