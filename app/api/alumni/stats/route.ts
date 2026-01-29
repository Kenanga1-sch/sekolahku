
import { NextRequest, NextResponse } from "next/server";
import { db, students } from "@/db"; // Use students
import { alumniDocuments, alumniDocumentTypes } from "@/db/schema/alumni"; // Keep for doc stats if needed
import { count, eq, sql } from "drizzle-orm";

// GET /api/alumni/stats - Get alumni statistics
export async function GET() {
  try {
    // Total alumni count (Master Data)
    const totalAlumniResult = await db
      .select({ count: count() })
      .from(students)
      .where(eq(students.status, "graduated"));
    const totalAlumni = totalAlumniResult[0]?.count || 0;

    // Total documents count (Legacy/Separate Table)
    const totalDocsResult = await db
      .select({ count: count() })
      .from(alumniDocuments);
    const totalDocuments = totalDocsResult[0]?.count || 0;

    // Pending verification count
    const pendingResult = await db
      .select({ count: count() })
      .from(alumniDocuments)
      .where(eq(alumniDocuments.verificationStatus, "pending"));
    const pendingVerification = pendingResult[0]?.count || 0;

    // Alumni by graduation year (Using strftime on updatedAt as proxy for MVP)
    const byYear = await db
      .select({
        graduationYear: sql<string>`strftime('%Y', ${students.updatedAt})`,
        count: count(),
      })
      .from(students)
      .where(eq(students.status, "graduated"))
      .groupBy(sql`strftime('%Y', ${students.updatedAt})`)
      .orderBy(sql`strftime('%Y', ${students.updatedAt})`)
      .limit(5);

    // Alumni by final class (using className)
    const byClass = await db
      .select({
        finalClass: students.className,
        count: count(),
      })
      .from(students)
      .where(eq(students.status, "graduated"))
      .groupBy(students.className)
      .orderBy(students.className);

    // Document types breakdown
    const docBreakdown = await db
      .select({
        typeName: alumniDocumentTypes.name,
        typeCode: alumniDocumentTypes.code,
        count: count(alumniDocuments.id),
      })
      .from(alumniDocumentTypes)
      .leftJoin(alumniDocuments, eq(alumniDocumentTypes.id, alumniDocuments.documentTypeId))
      .groupBy(alumniDocumentTypes.id)
      .orderBy(alumniDocumentTypes.sortOrder);

    return NextResponse.json({
      totalAlumni,
      totalDocuments,
      pendingVerification,
      byGraduationYear: byYear,
      byFinalClass: byClass.filter(c => c.finalClass),
      documentBreakdown: docBreakdown,
    });
  } catch (error) {
    console.error("Error fetching alumni stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni statistics" },
      { status: 500 }
    );
  }
}
