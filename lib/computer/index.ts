/**
 * Client modul "Komputer Belajar" perpustakaan.
 *
 * Alur: siswa kirim laporan baca (ringkasan/kesimpulan/pertanyaan) → guru
 * verifikasi → guru membuat booking komputer → siswa scan kartu di komputer
 * untuk memulai sesi → timer berjalan → waktu habis = layar terkunci.
 *
 * Bukan billing uang; hanya kuota menit per siswa (diatur admin, bisa per kelas).
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

// ================= Types =================

export interface ComputerStation {
  id: string;
  code: string;
  name: string;
  location: string;
  sortOrder: number;
  status: "active" | "maintenance" | "inactive";
  activeSession?: ComputerSession | null;
}

export interface ReadingReport {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  catalogId?: string;
  bookTitle: string;
  bookAuthor: string;
  summary: string;
  conclusion: string;
  question: string;
  status: "pending" | "approved" | "rejected";
  reviewNotes: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComputerBooking {
  id: string;
  stationId: string;
  stationName?: string;
  studentId: string;
  studentName: string;
  className: string;
  reportId?: string;
  slotStart: string;
  slotEnd: string;
  plannedMinutes: number;
  status: "booked" | "active" | "completed" | "cancelled" | "expired" | "no_show";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComputerSession {
  id: string;
  bookingId?: string;
  stationId: string;
  stationName?: string;
  studentId: string;
  studentName: string;
  startedAt: string;
  deadlineAt: string;
  endedAt?: string;
  minutesUsed: number;
  endReason: string;
}

export interface ComputerTimeQuota {
  studentId: string;
  studentName?: string;
  className?: string;
  totalMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
}

export interface QuotaPolicy {
  className: string;
  minutes: number;
}

// ================= Stasiun =================

export async function listStations(): Promise<ComputerStation[]> {
  const res = await goGet<{ items: ComputerStation[] }>("/api/computer/stations", { skipRetry: true });
  return res.items || [];
}

export async function createStation(data: Partial<ComputerStation>): Promise<void> {
  await goPost("/api/computer/stations", data);
}

export async function updateStation(id: string, data: Partial<ComputerStation>): Promise<void> {
  await goPut(`/api/computer/stations/${encodeURIComponent(id)}`, data);
}

export async function deleteStation(id: string): Promise<void> {
  await goDelete(`/api/computer/stations/${encodeURIComponent(id)}`);
}

// ================= Kuota =================

export async function listQuotaPolicies(): Promise<QuotaPolicy[]> {
  const res = await goGet<{ items: QuotaPolicy[] }>("/api/computer/quota-policies", { skipRetry: true });
  return res.items || [];
}

export async function setQuotaPolicy(className: string, minutes: number): Promise<void> {
  await goPut("/api/computer/quota-policies", { className, minutes });
}

export async function listQuotas(className?: string): Promise<ComputerTimeQuota[]> {
  const q = className ? `?className=${encodeURIComponent(className)}` : "";
  const res = await goGet<{ items: ComputerTimeQuota[] }>(`/api/computer/quotas${q}`, { skipRetry: true });
  return res.items || [];
}

export async function setStudentQuota(studentId: string, totalMinutes: number): Promise<ComputerTimeQuota> {
  const res = await goPut<{ data: ComputerTimeQuota }>("/api/computer/quotas", { studentId, totalMinutes });
  return res.data;
}

export async function getMyQuota(): Promise<ComputerTimeQuota> {
  const res = await goGet<{ data: ComputerTimeQuota }>("/api/student/me/computer/quota", { skipRetry: true });
  return res.data;
}

// ================= Laporan baca =================

export interface ReadingReportInput {
  catalogId?: string;
  bookTitle: string;
  bookAuthor?: string;
  summary: string;
  conclusion: string;
  question: string;
}

export async function createMyReadingReport(data: ReadingReportInput): Promise<ReadingReport> {
  const res = await goPost<{ data: ReadingReport }>("/api/student/me/computer/reading-reports", data);
  return res.data;
}

export async function listMyReadingReports(): Promise<ReadingReport[]> {
  const res = await goGet<{ items: ReadingReport[] }>("/api/student/me/computer/reading-reports", { skipRetry: true });
  return res.items || [];
}

export async function listReadingReports(status?: string, className?: string): Promise<ReadingReport[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (className) params.set("className", className);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await goGet<{ items: ReadingReport[] }>(`/api/computer/reading-reports${q}`, { skipRetry: true });
  return res.items || [];
}

export async function reviewReadingReport(id: string, approve: boolean, notes = ""): Promise<void> {
  await goPost(`/api/computer/reading-reports/${encodeURIComponent(id)}/review`, { approve, notes });
}

// ================= Booking =================

export interface CreateComputerBookingInput {
  stationId: string;
  studentId: string;
  reportId?: string;
  slotStart: string;
  plannedMinutes: number;
  notes?: string;
}

export async function createComputerBooking(data: CreateComputerBookingInput): Promise<ComputerBooking> {
  const res = await goPost<{ data: ComputerBooking }>("/api/computer/bookings", data);
  return res.data;
}

export async function listBookings(params?: { from?: number; to?: number; studentId?: string; stationId?: string; status?: string }): Promise<ComputerBooking[]> {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", String(params.from));
  if (params?.to) q.set("to", String(params.to));
  if (params?.studentId) q.set("studentId", params.studentId);
  if (params?.stationId) q.set("stationId", params.stationId);
  if (params?.status) q.set("status", params.status);
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await goGet<{ items: ComputerBooking[] }>(`/api/computer/bookings${qs}`, { skipRetry: true });
  return res.items || [];
}

export async function listMyBookings(): Promise<ComputerBooking[]> {
  const res = await goGet<{ items: ComputerBooking[] }>("/api/student/me/computer/bookings", { skipRetry: true });
  return res.items || [];
}

export async function cancelComputerBooking(id: string): Promise<void> {
  await goDelete(`/api/computer/bookings/${encodeURIComponent(id)}`);
}

// ================= Sesi / kiosk =================

export interface StationSessionState {
  station: { id: string; code: string; name: string };
  session: ComputerSession | null;
  remainingSeconds?: number;
  expired?: boolean;
}

export async function startSessionByScan(code: string, stationCode: string): Promise<ComputerSession> {
  const res = await goPost<{ data: ComputerSession }>("/api/computer/kiosk/start", { code, stationCode });
  return res.data;
}

export async function getStationSession(stationCode: string): Promise<StationSessionState> {
  return await goGet<StationSessionState>(`/api/computer/kiosk/stations/${encodeURIComponent(stationCode)}`, { skipRetry: true });
}

export async function endSession(id: string, reason = "manual"): Promise<void> {
  await goPost(`/api/computer/sessions/${encodeURIComponent(id)}/end`, { reason });
}

export async function listSessions(params?: { from?: number; to?: number; studentId?: string; stationId?: string }): Promise<ComputerSession[]> {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", String(params.from));
  if (params?.to) q.set("to", String(params.to));
  if (params?.studentId) q.set("studentId", params.studentId);
  if (params?.stationId) q.set("stationId", params.stationId);
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await goGet<{ items: ComputerSession[] }>(`/api/computer/sessions${qs}`, { skipRetry: true });
  return res.items || [];
}

// ================= Fungsi murni (diuji) =================

/** Menit desimal → "MM:SS" (dibulatkan ke atas detik). */
export function formatCountdown(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "00:00";
  const s = Math.ceil(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Detik sisa dari deadline (ISO/epoch) relatif ke `now` (ms). Negatif → 0. */
export function remainingSeconds(deadline: string | number, nowMs: number = Date.now()): number {
  const dl = typeof deadline === "number" ? deadline : Date.parse(deadline);
  if (!Number.isFinite(dl)) return 0;
  return Math.max(0, Math.floor((dl - nowMs) / 1000));
}

/** Total menit terpakai dari durasi menit yang diberikan. */
export function minutesFromSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.floor(seconds / 60);
}

/** Label status booking dalam Bahasa Indonesia. */
export function bookingStatusLabel(status: ComputerBooking["status"]): string {
  const map: Record<string, string> = {
    booked: "Terjadwal",
    active: "Sedang Dipakai",
    completed: "Selesai",
    cancelled: "Dibatalkan",
    expired: "Kedaluwarsa",
    no_show: "Tidak Hadir",
  };
  return map[status] || status;
}

/** Label status laporan baca. */
export function reportStatusLabel(status: ReadingReport["status"]): string {
  const map: Record<string, string> = {
    pending: "Menunggu Verifikasi",
    approved: "Disetujui",
    rejected: "Ditolak",
  };
  return map[status] || status;
}

/** Apakah sesi sudah lewat deadline. */
export function isSessionExpired(deadline: string | number, nowMs: number = Date.now()): boolean {
  const dl = typeof deadline === "number" ? deadline : Date.parse(deadline);
  if (!Number.isFinite(dl)) return true;
  return nowMs >= dl;
}
