/**
 * reports — Client-side data fetcher for Savings Reports
 */

import { goGet } from "@/lib/api-client";

export async function getStudentFinalReport(studentId: string) {
  return await goGet(`/api/savings/reports/final?studentId=${studentId}`);
}

export async function getStudentStatement(studentId: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams({ studentId });
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  
  return await goGet(`/api/savings/reports/statement?${params.toString()}`);
}

export async function verifyStatementHash(hash: string) {
  return await goGet(`/api/savings/reports/verify?hash=${hash}`);
}
