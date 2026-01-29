import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  attendanceSessions,
  attendanceRecords,
  ATTENDANCE_STATUS_OPTIONS,
} from "@/db/schema/attendance";
import { students } from "@/db/schema/students";
import { eq, desc, and, sql, count } from "drizzle-orm";

// GET /api/attendance/sessions - List sessions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const className = searchParams.get("class");
    const status = searchParams.get("status");

    let query = db
      .select({
        id: attendanceSessions.id,
        date: attendanceSessions.date,
        className: attendanceSessions.className,
        teacherName: attendanceSessions.teacherName,
        status: attendanceSessions.status,
        openedAt: attendanceSessions.openedAt,
        closedAt: attendanceSessions.closedAt,
        notes: attendanceSessions.notes,
        recordCount: sql<number>`(
          SELECT COUNT(*) FROM attendance_records 
          WHERE session_id = ${attendanceSessions.id}
        )`,
      })
      .from(attendanceSessions)
      .orderBy(desc(attendanceSessions.date), desc(attendanceSessions.openedAt));

    const conditions = [];
    if (date) {
      conditions.push(eq(attendanceSessions.date, date));
    }
    if (className) {
      conditions.push(eq(attendanceSessions.className, className));
    }
    if (status) {
      conditions.push(
        eq(attendanceSessions.status, status as "open" | "closed")
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const sessions = await query.limit(50);

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// POST /api/attendance/sessions - Create new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { className, teacherName, notes } = body;

    if (!className) {
      return NextResponse.json(
        { error: "Class name is required" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // Check if session already exists for this class today
    const existing = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.date, today),
          eq(attendanceSessions.className, className)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Session already exists for this class today", existing: existing[0] },
        { status: 409 }
      );
    }

    const [newSession] = await db
      .insert(attendanceSessions)
      .values({
        date: today,
        className,
        teacherName,
        notes,
        status: "open",
      })
      .returning();

    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
