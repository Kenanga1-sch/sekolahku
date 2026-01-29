import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords } from "@/db/schema/attendance";
import { students } from "@/db/schema/students";
import { eq, and, desc } from "drizzle-orm";

// POST /api/attendance/scan - Record attendance via QR scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrCode, sessionId, status = "hadir", recordedBy } = body;

    if (!qrCode) {
      return NextResponse.json(
        { error: "QR code is required" },
        { status: 400 }
      );
    }

    // Find student by QR code
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.qrCode, qrCode))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { error: "Student not found with this QR code" },
        { status: 404 }
      );
    }

    // Find active session
    let session;
    if (sessionId) {
      // Use specified session
      const [foundSession] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, sessionId))
        .limit(1);
      session = foundSession;
    } else {
      // Find today's open session for student's class
      const today = new Date().toISOString().split("T")[0];
      const [todaySession] = await db
        .select()
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.date, today),
            eq(attendanceSessions.className, student.className || ""),
            eq(attendanceSessions.status, "open")
          )
        )
        .limit(1);
      session = todaySession;
    }

    if (!session) {
      return NextResponse.json(
        { error: "No active session found for this student's class" },
        { status: 404 }
      );
    }

    if (session.status === "closed") {
      return NextResponse.json(
        { error: "Session is already closed" },
        { status: 400 }
      );
    }

    // Check if already recorded
    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, session.id),
          eq(attendanceRecords.studentId, student.id)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          error: "Student already recorded in this session",
          existing,
          student: {
            id: student.id,
            fullName: student.fullName,
            className: student.className,
            photo: student.photo,
          },
        },
        { status: 409 }
      );
    }

    // Create attendance record
    const [newRecord] = await db
      .insert(attendanceRecords)
      .values({
        sessionId: session.id,
        studentId: student.id,
        status: status as "hadir" | "sakit" | "izin" | "alpha",
        recordedBy,
        recordMethod: "qr_scan",
      })
      .returning();

    return NextResponse.json({
      message: "Attendance recorded successfully",
      record: newRecord,
      student: {
        id: student.id,
        fullName: student.fullName,
        className: student.className,
        photo: student.photo,
      },
      session: {
        id: session.id,
        className: session.className,
        date: session.date,
      },
    });
  } catch (error) {
    console.error("Error recording attendance:", error);
    return NextResponse.json(
      { error: "Failed to record attendance" },
      { status: 500 }
    );
  }
}
