/**
 * library — Client-side data fetcher
 * All database logic has been moved to the Golang backend.
 * These functions now fetch data via the Golang API.
 */

import { goGet } from "@/lib/api-client";

export async function revalidateLibraryStats() {
  // Simple re-fetch stats
  return await getCachedLibraryStats();
}

export async function getCachedLibraryStats() {
  const res = await goGet("/api/library/stats");
  if (!res || !res.success) {
    console.error("Failed to fetch library stats:", res);
    return null;
  }
  return res.data;
}
