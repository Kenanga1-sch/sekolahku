import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords } from "@/db/schema/attendance";
import { students } from "@/db/schema/students";
import { eq, and } from "drizzle-orm";

// POST /api/attendance/manual - Record attendance manually
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, studentId, status = "hadir", notes, recordedBy } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    // Verify session exists and is open
    const [session] = await db
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.status === "closed") {
      return NextResponse.json(
        { error: "Session is already closed" },
        { status: 400 }
      );
    }

    // Verify student exists
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Check if already recorded
    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, sessionId),
          eq(attendanceRecords.studentId, studentId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(attendanceRecords)
        .set({
          status: status as "hadir" | "sakit" | "izin" | "alpha",
          notes,
          recordedBy,
          recordMethod: "manual",
        })
        .where(eq(attendanceRecords.id, existing.id))
        .returning();

      return NextResponse.json({
        message: "Attendance updated successfully",
        record: updated,
        updated: true,
      });
    }

    // Create new record
    const [newRecord] = await db
      .insert(attendanceRecords)
      .values({
        sessionId,
        studentId,
        status: status as "hadir" | "sakit" | "izin" | "alpha",
        notes,
        recordedBy,
        recordMethod: "manual",
      })
      .returning();

    return NextResponse.json({
      message: "Attendance recorded successfully",
      record: newRecord,
      created: true,
    });
  } catch (error) {
    console.error("Error recording manual attendance:", error);
    return NextResponse.json(
      { error: "Failed to record attendance" },
      { status: 500 }
    );
  }
}
