import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords } from "@/db/schema/attendance";
import { students } from "@/db/schema/students";
import { eq, and } from "drizzle-orm";

// GET /api/attendance/sessions/[id] - Get session with records
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [session] = await db
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.id, id))
      .limit(1);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Get all records for this session with student info
    const records = await db
      .select({
        id: attendanceRecords.id,
        status: attendanceRecords.status,
        checkInTime: attendanceRecords.checkInTime,
        recordMethod: attendanceRecords.recordMethod,
        notes: attendanceRecords.notes,
        student: {
          id: students.id,
          fullName: students.fullName,
          nisn: students.nisn,
          nis: students.nis,
          className: students.className,
          photo: students.photo,
        },
      })
      .from(attendanceRecords)
      .leftJoin(students, eq(attendanceRecords.studentId, students.id))
      .where(eq(attendanceRecords.sessionId, id));

    // Get all students in this class
    const allStudents = await db
      .select()
      .from(students)
      .where(
        and(
          eq(students.className, session.className),
          eq(students.isActive, true)
        )
      );

    // Calculate stats
    const stats = {
      total: allStudents.length,
      hadir: records.filter((r) => r.status === "hadir").length,
      sakit: records.filter((r) => r.status === "sakit").length,
      izin: records.filter((r) => r.status === "izin").length,
      alpha: records.filter((r) => r.status === "alpha").length,
      belumAbsen: allStudents.length - records.length,
    };

    return NextResponse.json({
      ...session,
      records,
      allStudents,
      stats,
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

// PUT /api/attendance/sessions/[id] - Update/close session
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { status, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (status === "closed") {
      updateData.status = "closed";
      updateData.closedAt = new Date();
    }

    const [updated] = await db
      .update(attendanceSessions)
      .set(updateData)
      .where(eq(attendanceSessions.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// DELETE /api/attendance/sessions/[id] - Delete session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [deleted] = await db
      .delete(attendanceSessions)
      .where(eq(attendanceSessions.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Session deleted successfully" });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
