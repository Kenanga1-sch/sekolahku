import { goGet } from "@/lib/api-client";

export async function getTabunganStats() {
  return await goGet("/api/savings/stats");
}

export async function getTransactionTrend() {
  return await goGet("/api/savings/stats?type=trend");
}

export async function getSaldoByKelas() {
  return await goGet("/api/savings/stats?type=saldo-by-kelas");
}

export async function getTopSavers() {
  return await goGet("/api/savings/stats?type=top-savers");
}
