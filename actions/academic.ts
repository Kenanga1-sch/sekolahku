"use server";

import { db, academicYears } from "@/db";
import { eq } from "drizzle-orm";

export async function getActiveAcademicYear() {
  try {
    // 1. Try to find active academic year in academicYears table
    const activeYear = await db.query.academicYears.findFirst({
        where: eq(academicYears.isActive, true)
    });

    if (activeYear) {
        return { success: true, data: activeYear.name };
    }

    // 2. Fallback to School Settings
    const settings = await db.query.schoolSettings.findFirst();
    if (settings?.currentAcademicYear) {
        return { success: true, data: settings.currentAcademicYear };
    }

    return { success: true, data: "2024/2025" }; // Final Fallback
  } catch (error) {
    console.error("Failed to get academic year:", error);
    const message = error instanceof Error ? error.message : "Failed to get active academic year";
    return { success: false, error: message };
  }
}
