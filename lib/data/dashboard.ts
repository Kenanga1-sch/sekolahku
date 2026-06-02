/**
 * dashboard — Client-side data fetcher for Admin Dashboard
 */

import { goGet } from "@/lib/api-client";

export async function getDashboardStats() {
  return await goGet("/api/admin/dashboard/stats");
}

export async function getSystemHealth() {
  return await goGet("/api/admin/system/health");
}
