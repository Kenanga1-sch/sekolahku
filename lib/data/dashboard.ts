/**
 * dashboard — Client-side data fetcher
 * All database logic has been moved to the Golang backend.
 * These functions now fetch data via the Golang API.
 */

import { goGet, goPost } from "@/lib/api-client";

// TODO: Implement specific endpoints as needed.
// For now, functions export stubs that call the Go API.

export async function getDashboardStats() {
  const res = await goGet("/api/admin/dashboard/stats");
  if (!res.success) {
    throw new Error(res.error || "Failed to fetch dashboard stats");
  }
  return res.data;
}

export async function getSystemHealth() {
  const res = await goGet("/api/admin/system/health");
  if (!res.success) {
    throw new Error(res.error || "Failed to fetch system health");
  }
  return res.data;
}
