"use server";

export async function getActiveAcademicYear() {
  try {
    const response = await fetch("http://localhost:8080/api/academic/active-year", {
        cache: 'no-store' // Ensuring fresh data, can be tuned later
    });
    
    if (!response.ok) {
        throw new Error("API returned non-OK status");
    }
    
    const result = await response.json();
    return result; // Returns { success: true, data: "..." }
  } catch (error) {
    console.error("Failed to get academic year from Go API:", error);
    const message = error instanceof Error ? error.message : "Failed to get active academic year";
    return { success: false, error: message };
  }
}
