import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords } from "@/db/schema/attendance";
import { students } from "@/db/schema/students";
import { eq, and, desc } from "drizzle-orm";

// POST /api/attendance/scan - Record attendance via QR scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch("http://localhost:8080/api/academic/attendance/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return NextResponse.json(
            { error: errData.error || "Failed to record attendance via Go API" },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error recording attendance:", error);
    return NextResponse.json(
      { error: "Failed to record attendance" },
      { status: 500 }
    );
  }
}
