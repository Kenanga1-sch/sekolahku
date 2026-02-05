"use server";

import { db, academicYears, schoolSettings } from "@/db";
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
  } catch (error: any) {
    console.error("Failed to get academic year:", error);
    return { success: false, error: error.message };
  }
}
