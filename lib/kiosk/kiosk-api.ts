// API helper bersama untuk halaman kiosk (/kiosk dan /kiosk-kelas).
// Semua request memakai skipRetry agar tidak menggandakan aksi saat jaringan
// lambat di perangkat kiosk.

import { goPost } from "@/lib/api-client";

/**
 * Optimized scan endpoint - combines:
 * - smartScan (identify QR)
 * - hasVisitedToday + recordVisit (check/record visit)
 * - getMemberActiveLoans (get loans)
 * Performance: 4 API calls → 1 API call (60-70% faster)
 */
export async function apiSmartScanComplete(code: string) {
  return goPost("/api/kiosk/scan-complete", { code }, { skipRetry: true });
}

export async function apiBorrowBook(memberId: string, itemId: string) {
  return goPost("/api/kiosk/transaction", { type: "borrow", memberId, itemId }, { skipRetry: true });
}

export async function apiReturnBook(loanId: string) {
  return goPost("/api/kiosk/transaction", { type: "return", loanId }, { skipRetry: true });
}

/** Pengembalian dalam 1 request: backend mencari pinjaman aktif via item_id. */
export async function apiReturnByItem(itemId: string) {
  return goPost("/api/kiosk/transaction", { type: "return-by-item", itemId }, { skipRetry: true });
}

export async function apiAttendanceScan(qrCode: string) {
  return goPost("/api/kiosk/attendance", { qrCode }, { skipRetry: true });
}

export async function apiSavingsLookup(qrCode: string) {
  const { goGet } = await import("@/lib/api-client");
  return goGet(`/api/kiosk/savings-lookup?qrCode=${encodeURIComponent(qrCode)}`, { skipRetry: true });
}

export async function apiSavingsDeposit(qrCode: string, nominal: number) {
  return goPost("/api/kiosk/savings-deposit", { qrCode, nominal }, { skipRetry: true });
}
