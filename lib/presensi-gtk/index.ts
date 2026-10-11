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

// ==========================================================================
// Laporan bulanan
// ==========================================================================

export interface GtkMonthlyRow {
  employeeId: string;
  name: string;
  nip: string;
  category: string;
  employmentStatus: string;
  extracurricular?: string;
  dailyStatus: Record<string, string>; // "YYYY-MM-DD" → hadir|sakit|izin|alpha
  totalHadir: number;
  totalSakit: number;
  totalIzin: number;
  totalAlpha: number;
}

export interface GtkMonthlyReport {
  year: number;
  month: number;
  effectiveDays: number;
  holidays: { date: string; reason: string }[];
  rows: GtkMonthlyRow[];
}

export interface GtkAnnualRow {
  employeeId: string;
  name: string;
  nip: string;
  category: string;
  employmentStatus: string;
  extracurricular?: string;
  totalHadir: number;
  totalSakit: number;
  totalIzin: number;
  totalAlpha: number;
  effectiveDays: number;
}

export interface GtkAnnualReport {
  year: number;
  startMonth: number;
  endMonth: number;
  effectiveDays: number;
  rows: GtkAnnualRow[];
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
  monthly: (year: number, month: number, type?: "gtk" | "ekskul") =>
    goGet<{ data: GtkMonthlyReport }>(
      `/api/gtk-attendance/monthly?year=${year}&month=${month}${type ? `&type=${type}` : ""}`
    ),
  range: (year: number, startMonth: number, endMonth: number, type?: "gtk" | "ekskul") =>
    goGet<{ data: GtkAnnualReport }>(
      `/api/gtk-attendance/range?year=${year}&startMonth=${startMonth}&endMonth=${endMonth}${type ? `&type=${type}` : ""}`
    ),
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

// ==========================================================================
// Helper laporan bulanan (murni, mudah diuji)
// ==========================================================================

export const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

/** "YYYY-MM-DD" untuk hari ke-N pada bulan tertentu. */
export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Jumlah hari dalam bulan (1..12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Kode status presensi → huruf (H/S/I/A/-). */
export function statusLetter(status: string): "H" | "S" | "I" | "A" | "-" {
  switch ((status || "").toLowerCase()) {
    case "hadir":
      return "H";
    case "sakit":
      return "S";
    case "izin":
      return "I";
    case "alpha":
      return "A";
    default:
      return "-";
  }
}

/**
 * Persentase kehadiran GTK: hadir ÷ hari efektif, 1 desimal, maks 100.
 * null bila tak ada hari efektif atau belum ada catatan (bukan 0% menyesatkan).
 */
export function gtkAttendancePct(row: GtkMonthlyRow, effectiveDays: number): number | null {
  if (effectiveDays <= 0) return null;
  const recorded = row.totalHadir + row.totalSakit + row.totalIzin + row.totalAlpha;
  if (recorded === 0) return null;
  return Math.min(Math.round((row.totalHadir / effectiveDays) * 1000) / 10, 100);
}

/** Persentase kehadiran agregat (semua GTK). */
export function overallAttendancePct(rows: GtkMonthlyRow[], effectiveDays: number): number | null {
  const denom = rows.length * effectiveDays;
  if (denom <= 0) return null;
  const hadir = rows.reduce((n, r) => n + r.totalHadir, 0);
  return Math.min(Math.round((hadir / denom) * 1000) / 10, 100);
}

/** Nama bulan Indonesia dari 1..12. */
export function monthName(month: number): string {
  return MONTH_NAMES_ID[month - 1] || String(month);
}

/** Nama file ekspor (tanpa ekstensi). */
export function monthlyFilename(year: number, month: number, type?: "gtk" | "ekskul"): string {
  const slug = type === "ekskul" ? "ekskul" : "gtk";
  return `laporan-presensi-${slug}-${year}-${String(month).padStart(2, "0")}`;
}

// ==========================================================================
// Ambang kehadiran & rekap tahunan/semester
// ==========================================================================

/** Ambang minimum kehadiran (%) — di bawah ini dianggap perlu perhatian. */
export const MIN_ATTENDANCE_PCT = 75;

/** Ambang peringatan default untuk laporan GTK. */
export const ATTENDANCE_WARNING_THRESHOLD = MIN_ATTENDANCE_PCT;

/** Definisi semester (rentang bulan) untuk rekap. */
export const SEMESTERS = {
  ganjil: { label: "Semester Ganjil (Jul–Des)", startMonth: 7, endMonth: 12 },
  genap: { label: "Semester Genap (Jan–Jun)", startMonth: 1, endMonth: 6 },
} as const;

export type SemesterKey = keyof typeof SEMESTERS;

/** Apakah persentase kehadiran di bawah ambang (perlu perhatian). */
export function isBelowThreshold(pct: number | null, threshold = ATTENDANCE_WARNING_THRESHOLD): boolean {
  return pct !== null && pct < threshold;
}

/** Persentase kehadiran untuk baris rekap tahunan/semester. */
export function annualAttendancePct(row: GtkAnnualRow): number | null {
  if (row.effectiveDays <= 0) return null;
  const recorded = row.totalHadir + row.totalSakit + row.totalIzin + row.totalAlpha;
  if (recorded === 0) return null;
  return Math.min(Math.round((row.totalHadir / row.effectiveDays) * 1000) / 10, 100);
}

/** Persentase kehadiran agregat untuk laporan tahunan/semester. */
export function overallAnnualPct(rows: GtkAnnualRow[], effectiveDays: number): number | null {
  const denom = rows.length * effectiveDays;
  if (denom <= 0) return null;
  const hadir = rows.reduce((n, r) => n + r.totalHadir, 0);
  return Math.min(Math.round((hadir / denom) * 1000) / 10, 100);
}

/** Label rentang bulan untuk judul laporan (mis. "Jul–Des 2026"). */
export function monthRangeLabel(startMonth: number, endMonth: number, year: number): string {
  const short = (m: number) => (MONTH_NAMES_ID[m - 1] || String(m)).slice(0, 3);
  return `${short(startMonth)}–${short(endMonth)} ${year}`;
}

/** Nama file ekspor rekap tahunan/semester. */
export function rangeFilename(year: number, startMonth: number, endMonth: number, type?: "gtk" | "ekskul"): string {
  const slug = type === "ekskul" ? "ekskul" : "gtk";
  return `rekap-presensi-${slug}-${year}-${String(startMonth).padStart(2, "0")}-${String(endMonth).padStart(2, "0")}`;
}
