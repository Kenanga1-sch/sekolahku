/**
 * SPMB — Client-side data fetcher for Go API
 * Optimized with handleAction and Caching.
 */

import { goGet, goPost, goPut, CacheTTL } from "@/lib/api-client";
import { handleAction } from "@/lib/action-utils";

interface SPMBQueryOptions {
  page?: number;
  limit?: number;
  filter?: string;
}

export async function getActivePeriod() {
  return handleAction(goGet("/api/spmb/periods/active", { ttl: CacheTTL.LONG }));
}

export async function getAllPeriods(options: SPMBQueryOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  
  return handleAction(goGet(`/api/spmb/periods?${params}`, { ttl: CacheTTL.MEDIUM }));
}

export async function getRegistrants(options: SPMBQueryOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.filter) params.append('filter', options.filter);
  
  return handleAction(goGet(`/api/spmb/registrants?${params}`, { ttl: CacheTTL.SHORT }));
}

export async function getRegistrantByRegistrationNumber(regNum: string) {
  return handleAction(goGet(`/api/spmb/registrants/regnum/${regNum}`, { ttl: CacheTTL.SHORT }));
}

export async function getRegistrantByNik(nik: string) {
  return handleAction(goGet(`/api/spmb/registrants/nik/${nik}`, { ttl: CacheTTL.SHORT }));
}

export async function getRegistrantById(id: string) {
  return handleAction(goGet(`/api/spmb/registrants/${id}`, { ttl: CacheTTL.SHORT }));
}

export async function generateRegistrationNumber() {
  const res = await handleAction(goGet("/api/spmb/registrants/next-number"));
  return res.success ? (res.data as any).number : "SPMB-2026-0001";
}

export async function createRegistrant(data: any) {
  return handleAction(goPost("/api/spmb/registrants", data), "Pendaftaran berhasil dikirim");
}

export async function updateRegistrant(id: string, data: any) {
  return handleAction(goPut(`/api/spmb/registrants/${id}`, data), "Data pendaftar berhasil diperbarui");
}

export async function getSPMBStats() {
  return handleAction(goGet("/api/spmb/stats", { ttl: CacheTTL.MEDIUM }));
}

