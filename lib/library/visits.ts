/**
 * visits — Client-side data fetcher for Library Visits
 */

import { goGet, goPost } from "@/lib/api-client";

export async function recordVisit(data: { memberId?: string; guestName?: string; institution?: string; purpose?: string }) {
  return await goPost("/api/library/visits/manual", data);
}

export async function hasVisitedToday(memberId: string) {
  // This could call a specific endpoint or just check the list
  const res: any = await goGet(`/api/library/visits?date=${new Date().toISOString().split('T')[0]}`);
  if (res.success && Array.isArray(res.data)) {
    return res.data.some((v: any) => v.memberId === memberId);
  }
  return false;
}

export async function getVisitReport(date?: string) {
  const url = date ? `/api/library/visits?date=${date}` : "/api/library/visits";
  return await goGet(url);
}
