/**
 * reports — Client-side data fetcher
 * All database logic has been moved to the Golang backend.
 * These functions now fetch data via the Golang API.
 */

import { goGet, goPost } from "@/lib/api-client";

// TODO: Implement specific endpoints as needed.
// For now, functions export stubs that call the Go API.

export async function getStudentFinalReport(...args: any[]) {
  // TODO: Wire to Golang API endpoint
  console.warn("getStudentFinalReport: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function getStudentStatement(...args: any[]) {
  // TODO: Wire to Golang API endpoint
  console.warn("getStudentStatement: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function verifyStatementHash(...args: any[]) {
  // TODO: Wire to Golang API endpoint
  console.warn("verifyStatementHash: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}
