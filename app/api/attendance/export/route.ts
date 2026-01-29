import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords } from "@/db/schema/attendance";
import { students } from "@/db/schema/students";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// GET /api/attendance/export - Export attendance reports
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const className = searchParams.get("class");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    // Build query conditions
    const conditions = [
      gte(attendanceSessions.date, startDate),
      lte(attendanceSessions.date, endDate),
    ];

    if (className && className !== "all") {
      conditions.push(eq(attendanceSessions.className, className));
    }

    // specific status? currently returning all records
    
    // Fetch sessions
    const sessions = await db
      .select()
      .from(attendanceSessions)
      .where(and(...conditions))
      .orderBy(desc(attendanceSessions.date));

    if (sessions.length === 0) {
      return new NextResponse("Tanggal,Kelas,Nama Guru,Status Sesi\n", {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="attendance-report.csv"`,
        },
      });
    }

    const sessionIds = sessions.map((s) => s.id);

    // Fetch records for these sessions
    const records = await db
      .select({
        sessionId: attendanceRecords.sessionId,
        status: attendanceRecords.status,
        checkInTime: attendanceRecords.checkInTime,
        recordMethod: attendanceRecords.recordMethod,
        studentName: students.fullName,
        studentNis: students.nis,
        studentClassName: students.className,
      })
      .from(attendanceRecords)
      .leftJoin(students, eq(attendanceRecords.studentId, students.id))
      .where(
        sql`${attendanceRecords.sessionId} IN (${sql.join(
          sessionIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    // Map records by session ID
    const recordsBySession = records.reduce((acc, record) => {
      if (!acc[record.sessionId]) {
        acc[record.sessionId] = [];
      }
      acc[record.sessionId].push(record);
      return acc;
    }, {} as Record<string, typeof records>);

    // Generate CSV
    const csvRows = [
      "Tanggal,Kelas,Guru,Siswa,NIS,Status,Waktu Check-in,Metode",
    ];

    for (const session of sessions) {
      const sessionRecords = recordsBySession[session.id] || [];
      
      if (sessionRecords.length === 0) {
        // If no records (e.g. empty session), still list the session? 
        // Or maybe skip. Let's list session with empty student data implies no attendance recorded
        continue; 
      }

      for (const record of sessionRecords) {
        const dateStr = format(new Date(session.date), "dd/MM/yyyy", { locale: localeId });
        const timeStr = record.checkInTime 
          ? format(new Date(record.checkInTime), "HH:mm:ss") 
          : "-";
        
        const row = [
          dateStr,
          `"${session.className}"`,
          `"${session.teacherName || "-"}"`,
          `"${record.studentName}"`,
          `"${record.studentNis || "-"}"`,
          record.status.toUpperCase(),
          timeStr,
          record.recordMethod === "qr_scan" ? "QR Code" : "Manual",
        ];

        csvRows.push(row.join(","));
      }
    }

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="attendance_${startDate}_${endDate}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting attendance:", error);
    return NextResponse.json(
      { error: "Failed to export attendance" },
      { status: 500 }
    );
  }
}

import { sql } from "drizzle-orm";
