/**
 * kelas — Client-side data fetcher for Savings Class Management
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

export async function getKelas() {
  return await goGet("/api/savings/kelas");
}

export async function getAllKelas() {
  return await goGet("/api/savings/kelas");
}

export async function createKelas(data: { nama: string; waliKelas?: string }) {
  return await goPost("/api/savings/kelas", data);
}

export async function updateKelas(id: string, data: { nama: string; waliKelas?: string }) {
  return await goPut(`/api/savings/kelas/${id}`, data);
}

export async function deleteKelas(id: string) {
  return await goDelete(`/api/savings/kelas/${id}`);
}

export async function assignClassRep(classId: string, userId: string) {
  return await goPost(`/api/savings/kelas/${classId}/assign-rep`, { userId });
}
