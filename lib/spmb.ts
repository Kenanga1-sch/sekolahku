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
  if (options.filter) params.append('search', options.filter);

  return handleAction(goGet(`/api/spmb/registrants?${params}`, { ttl: CacheTTL.SHORT }));
}

export async function getRegistrantByRegistrationNumber(regNum: string) {
  return handleAction(goGet(`/api/spmb/registrants/${regNum}`, { ttl: CacheTTL.SHORT }));
}

export async function getRegistrantById(id: string) {
  return handleAction(goGet(`/api/spmb/registrants/${id}`, { ttl: CacheTTL.SHORT }));
}

export async function getSPMBStats() {
  return handleAction(goGet("/api/spmb/stats", { ttl: CacheTTL.MEDIUM }));
}
