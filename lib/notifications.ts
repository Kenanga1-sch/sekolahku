/**
 * notifications — Client-side data fetcher
 * All database logic has been moved to the Golang backend.
 * These functions now fetch data via the Golang API.
 */

import { goGet, goPost } from "@/lib/api-client";

// TODO: Implement specific endpoints as needed.
// For now, functions export stubs that call the Go API.

export async function createNotification(...args: any[]) {
  console.warn("createNotification: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function broadcastNotification(...args: any[]) {
  console.warn("broadcastNotification: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function createSystemAlert(...args: any[]) {
  console.warn("createSystemAlert: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}
