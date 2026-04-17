/**
 * Client-side academic actions — fetches directly from Golang API.
 */

import { goGet } from "@/lib/api-client";

export async function getActiveAcademicYear() {
  try {
    return await goGet("/api/academic/active-year");
  } catch (error) {
    console.error("Failed to get academic year:", error);
    const message = error instanceof Error ? error.message : "Failed to get active academic year";
    return { success: false, error: message };
  }
}
