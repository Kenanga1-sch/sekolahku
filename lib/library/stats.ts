/**
 * stats — Client-side data fetcher for Library Statistics
 */

import { goGet } from "@/lib/api-client";
import type { LibraryStats } from "@/types/library";

export async function getLibraryStats(): Promise<LibraryStats | null> {
  try {
    const res: any = await goGet("/api/library/stats");
    return res.success ? res.data : null;
  } catch (error) {
    console.error("Failed to fetch library stats:", error);
    return null;
  }
}

export async function getLoanReport() {
  // Mocking or wiring to generic report endpoint if exists
  return await goGet("/api/library/reports/loans");
}

export async function getRecentActivity() {
  return await goGet("/api/library/activity");
}

export async function getLoanTrend() {
  return await goGet("/api/library/reports/trends");
}

export async function getCategoryDistribution() {
  return await goGet("/api/library/reports/categories");
}
