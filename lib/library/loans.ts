/**
 * loans — Client-side data fetcher for Library Loans
 */

import { goGet, goPost } from "@/lib/api-client";

export interface LoanQueryOptions {
  page?: number;
  limit?: number;
  type?: "active" | "overdue" | "all";
}

export async function getLoans(options: LoanQueryOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.type) params.append('type', options.type);
  
  return await goGet(`/api/library/loans?${params.toString()}`);
}

export async function borrowBook(data: { memberId: string; itemId: string; loanDays?: number }) {
  return await goPost('/api/library/loans', data);
}

export async function returnBook(loanId: string) {
  // Backend handler accepts loanId as URL param or potentially item QR
  return await goPost(`/api/library/loans/${loanId}/return`, {});
}

// Compatibility exports
export async function getActiveLoans(options: LoanQueryOptions = {}) {
  return getLoans({ ...options, type: "active" });
}

export async function getOverdueLoans(options: LoanQueryOptions = {}) {
  return getLoans({ ...options, type: "overdue" });
}
