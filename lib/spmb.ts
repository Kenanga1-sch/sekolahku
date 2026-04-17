/**
 * spmb — Client-side data fetcher
 * All database logic has been moved to the Golang backend.
 * These functions now fetch data via the Golang API.
 */

import { goGet, goPost } from "@/lib/api-client";

// TODO: Implement specific endpoints as needed.
// For now, functions export stubs that call the Go API.

export async function getActivePeriod(...args: any[]) {
  console.warn("getActivePeriod: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function getAllPeriods(...args: any[]) {
  console.warn("getAllPeriods: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function getRegistrants(...args: any[]) {
  console.warn("getRegistrants: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function getRegistrantByRegistrationNumber(...args: any[]) {
  console.warn("getRegistrantByRegistrationNumber: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function getRegistrantByNik(...args: any[]) {
  console.warn("getRegistrantByNik: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function getRegistrantById(...args: any[]) {
  console.warn("getRegistrantById: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function generateRegistrationNumber(...args: any[]) {
  console.warn("generateRegistrationNumber: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function createRegistrant(...args: any[]) {
  console.warn("createRegistrant: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function updateRegistrant(...args: any[]) {
  console.warn("updateRegistrant: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function getSPMBStats(...args: any[]) {
  console.warn("getSPMBStats: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}
