import { goGet, goPost, goPut, goDelete } from "./api-client";

// ══════════════════════════════════════════════════════════
// Types (mirror go-backend/internal/models/tugas.go)
// ══════════════════════════════════════════════════════════

export interface Tugas {
  id: string;
  teacherUserId: string;
  teacherName?: string;
  classId: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  academicYear?: string;
  title: string;
  description?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  dueAt?: number | null;
  allowLate: boolean;
  status: "published" | "archived";
  createdAt: number;
  updatedAt?: number;
  // agregat (view guru)
  totalStudents?: number;
  submittedCount?: number;
  gradedCount?: number;
  // status pengumpulan sendiri (view siswa/ortu)
  mySubmissionId?: string;
  myStatus?: "" | "submitted" | "graded";
  mySubmittedAt?: number | null;
  myIsLate?: boolean;
  myScore?: number | null;
  myAnswerText?: string;
  myAttachmentUrl?: string;
  myAttachmentName?: string;
  myFeedback?: string;
  // penanda anak (view ortu)
  studentId?: string;
  studentName?: string;
}

export interface TugasSubmission {
  id: string;
  tugasId: string;
  studentId: string;
  studentName?: string;
  answerText?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  submittedAt: number;
  isLate: boolean;
  score?: number | null;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: number | null;
  status: "submitted" | "graded";
  createdAt: number;
}

export interface TugasRosterItem {
  studentId: string;
  studentName: string;
  submissionId?: string;
  submittedAt?: number | null;
  isLate?: boolean;
  score?: number | null;
  feedback?: string;
  status?: "" | "submitted" | "graded";
}

export interface CreateTugasBody {
  title: string;
  description?: string;
  subjectId?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  dueAt?: number | null;
  allowLate?: boolean;
}

export interface SubmitTugasBody {
  answerText?: string;
  attachmentUrl?: string;
  attachmentName?: string;
}

// ══════════════════════════════════════════════════════════
// API — guru
// ══════════════════════════════════════════════════════════

export async function listTugas(params?: { classId?: string; status?: string; q?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params?.classId) qs.set("classId", params.classId);
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  if (params?.page) qs.set("page", String(params.page));
  const res = await goGet<{ success: boolean; data: Tugas[]; total: number }>(`/api/tugas?${qs.toString()}`);
  return { data: res?.data || [], total: res?.total || 0 };
}

export async function createTugas(body: CreateTugasBody) {
  const res = await goPost<{ success: boolean; data: Tugas }>("/api/tugas", body);
  return res?.data;
}

export async function getTugas(id: string) {
  const res = await goGet<{ success: boolean; data: Tugas }>(`/api/tugas/${id}`);
  return res?.data;
}

export async function updateTugas(id: string, body: CreateTugasBody) {
  const res = await goPut<{ success: boolean; data: Tugas }>(`/api/tugas/${id}`, body);
  return res?.data;
}

export async function deleteTugas(id: string) {
  await goDelete(`/api/tugas/${id}`);
}

export async function archiveTugas(id: string, archived: boolean) {
  await goPost(`/api/tugas/${id}/archive`, { archived });
}

export async function listTugasRoster(id: string) {
  const res = await goGet<{ success: boolean; data: TugasRosterItem[] }>(`/api/tugas/${id}/roster`);
  return res?.data || [];
}

export async function listTugasSubmissions(id: string) {
  const res = await goGet<{ success: boolean; data: TugasSubmission[] }>(`/api/tugas/${id}/submissions?limit=100`);
  return res?.data || [];
}

export async function gradeTugasSubmission(tugasId: string, subId: string, body: { score?: number | null; feedback?: string }) {
  const res = await goPut<{ success: boolean; data: TugasSubmission }>(`/api/tugas/${tugasId}/submissions/${subId}/grade`, body);
  return res?.data;
}

export async function remindTugas(id: string) {
  const res = await goPost<{ success: boolean; reminded: number }>(`/api/tugas/${id}/remind`);
  return res?.reminded || 0;
}

// ══════════════════════════════════════════════════════════
// API — siswa
// ══════════════════════════════════════════════════════════

export async function listMyTugas() {
  const res = await goGet<{ success: boolean; data: Tugas[]; total: number }>(`/api/student/me/tugas?limit=100`);
  return { data: res?.data || [], total: res?.total || 0 };
}

export async function getMyTugas(id: string) {
  const res = await goGet<{ success: boolean; data: Tugas }>(`/api/student/me/tugas/${id}`);
  return res?.data;
}

export async function submitMyTugas(id: string, body: SubmitTugasBody) {
  const res = await goPost<{ success: boolean; data: TugasSubmission }>(`/api/student/me/tugas/${id}/submit`, body);
  return res?.data;
}

// ══════════════════════════════════════════════════════════
// API — orang tua
// ══════════════════════════════════════════════════════════

export async function listChildrenTugas(studentId?: string) {
  const qs = studentId ? `?studentId=${studentId}` : "";
  const res = await goGet<{ success: boolean; data: Tugas[] }>(`/api/parent/tugas${qs}`);
  return res?.data || [];
}

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════

export const MY_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  "": { label: "Belum mengumpulkan", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  submitted: { label: "Terkumpul", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" },
  graded: { label: "Dinilai", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
};

export const ROSTER_STATUS_LABEL: Record<string, { label: string; cls: string }> = MY_STATUS_LABEL;

/** Label batas waktu dengan hitung mundur (mis. "3 hari lagi · 20 Sep 2026, 23:59"). */
export function deadlineLabel(dueAt?: number | null): string {
  if (!dueAt) return "Tanpa batas waktu";
  const d = new Date(dueAt);
  const fmt = d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const diff = dueAt - Date.now();
  if (diff < 0) return `Terlewat · ${fmt}`;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days} hari lagi · ${fmt}`;
  if (hours >= 1) return `${hours} jam lagi · ${fmt}`;
  return `Kurang dari 1 jam · ${fmt}`;
}

export function isOverdue(t: Tugas): boolean {
  return !!t.dueAt && t.dueAt < Date.now();
}

/** Apakah siswa masih bisa mengumpulkan (belum dinilai & masih dibuka). */
export function canSubmit(t: Tugas): boolean {
  if (!t || t.status !== "published") return false;
  if (t.myStatus === "graded") return false;
  if (isOverdue(t) && !t.allowLate) return false;
  return true;
}

export function formatDate(millis?: number | null): string {
  if (!millis) return "-";
  return new Date(millis).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
