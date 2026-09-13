/**
 * Portal Orang Tua & pengajuan izin/sakit.
 */

import { goGet, goPost, goDelete } from "@/lib/api-client";
import { handleAction } from "@/lib/action-utils";

// ===== Publik (pendaftaran akun) =====
export async function verifyStudentAction(nisn: string, birthDate: string) {
  return handleAction(goPost("/api/public/parent/verify", { nisn, birthDate }));
}

export async function registerParentAction(payload: {
  nisn: string;
  birthDate: string;
  name: string;
  phone: string;
  password: string;
  relation?: string;
}) {
  return handleAction(goPost("/api/public/parent/register", payload));
}

// ===== Portal orang tua =====
export async function getChildrenAction() {
  return handleAction(goGet("/api/parent/children"));
}

export async function getMyLeavesAction() {
  return handleAction(goGet("/api/parent/leave-requests"));
}

export async function createLeaveAction(payload: {
  studentId: string;
  type: "izin" | "sakit";
  startDate: string;
  endDate: string;
  reason: string;
}) {
  return handleAction(goPost("/api/parent/leave-requests", payload), "Pengajuan terkirim");
}

// ===== Guru / admin (peninjauan) =====
export async function listLeavesAction(status?: string, className?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (className) params.set("class", className);
  const q = params.toString();
  return handleAction(goGet(`/api/leave-requests${q ? `?${q}` : ""}`));
}

export async function reviewLeaveAction(id: string, status: "approved" | "rejected", note?: string) {
  return handleAction(goPost(`/api/leave-requests/${id}/review`, { status, note }), "Pengajuan diproses");
}

// ===== Admin: tautan ortu <-> siswa =====
export async function getStudentParentsAction(studentId: string) {
  return handleAction(goGet(`/api/master/students/${studentId}/parents`));
}

export async function linkParentAction(studentId: string, phone: string, relation?: string) {
  return handleAction(goPost(`/api/master/students/${studentId}/parents`, { phone, relation }), "Orang tua ditautkan");
}

export async function unlinkParentAction(studentId: string, userId: string) {
  return handleAction(goDelete(`/api/master/students/${studentId}/parents/${userId}`), "Tautan dilepas");
}
