import { goGet } from "@/lib/api-client";

export async function getTabunganStats() {
  return await goGet("/api/savings/stats");
}

export async function getTransactionTrend() {
  // Use stats or specialized endpoint if implemented
  return await goGet("/api/savings/stats/trend");
}

export async function getSaldoByKelas() {
  return await goGet("/api/savings/stats/by-class");
}

export async function getTopSavers() {
  return await goGet("/api/savings/stats/top-savers");
}
