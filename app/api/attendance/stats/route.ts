import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords } from "@/db/schema/attendance";
import { students } from "@/db/schema/students";
import { eq, and, sql, count } from "drizzle-orm";

// GET /api/attendance/stats - Get attendance statistics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const className = searchParams.get("class");

    // Get today's sessions
    let sessionsQuery = db
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.date, date));

    if (className) {
      sessionsQuery = sessionsQuery.where(
        and(
          eq(attendanceSessions.date, date),
          eq(attendanceSessions.className, className)
        )
      ) as typeof sessionsQuery;
    }

    const sessions = await sessionsQuery;

    // Get total active students
    let studentsQuery = db
      .select({ count: count() })
      .from(students)
      .where(eq(students.isActive, true));

    if (className) {
      studentsQuery = studentsQuery.where(
        and(eq(students.isActive, true), eq(students.className, className))
      ) as typeof studentsQuery;
    }

    const [{ count: totalStudents }] = await studentsQuery;

    // Get attendance records for today
    const sessionIds = sessions.map((s) => s.id);
    
    let hadir = 0, sakit = 0, izin = 0, alpha = 0;
    
    if (sessionIds.length > 0) {
      const records = await db
        .select({
          status: attendanceRecords.status,
          count: count(),
        })
        .from(attendanceRecords)
        .where(sql`${attendanceRecords.sessionId} IN (${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(attendanceRecords.status);

      for (const r of records) {
        if (r.status === "hadir") hadir = r.count;
        else if (r.status === "sakit") sakit = r.count;
        else if (r.status === "izin") izin = r.count;
        else if (r.status === "alpha") alpha = r.count;
      }
    }

    const recorded = hadir + sakit + izin + alpha;
    const belumAbsen = totalStudents - recorded;
    const persenKehadiran = totalStudents > 0 
      ? Math.round((hadir / totalStudents) * 100) 
      : 0;

    return NextResponse.json({
      date,
      totalStudents,
      sessions: sessions.length,
      openSessions: sessions.filter((s) => s.status === "open").length,
      stats: {
        hadir,
        sakit,
        izin,
        alpha,
        belumAbsen: belumAbsen > 0 ? belumAbsen : 0,
        recorded,
        persenKehadiran,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
