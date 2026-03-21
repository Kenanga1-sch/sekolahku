import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { studentGrades, teacherTp } from "@/db/schema/curriculum";
import { students } from "@/db/schema/students";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tpId = searchParams.get("tpId");
    // const classId = searchParams.get("class"); // In real app filter by class

    // Fetch existing grades for this TP
    const grades = await db.select({
        id: studentGrades.id,
        studentId: studentGrades.studentId,
        studentName: students.fullName,
        score: studentGrades.score,
        type: studentGrades.type,
        notes: studentGrades.notes
    })
    .from(studentGrades)
    .leftJoin(students, eq(studentGrades.studentId, students.id))
    .where(tpId ? eq(studentGrades.tpId, tpId) : undefined);

    // If we had a class filter, we should also fetch ALL students in that class 
    // and merge with grades to show empty slots. 
    // For this MVP, we just return the grades found or all students if we implement that.
    
    // Let's fetch strict students list if we want to build a grid
    // For now, let's just return what we have.
    
    return NextResponse.json({ success: true, data: grades });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to fetch grades" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Relay bulk upserts to Golang
    const res = await fetch("http://localhost:8080/api/academic/grades/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal menyimpan nilai massal via Go API");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
     return NextResponse.json({ success: false, error: "Failed to save grades" }, { status: 500 });
  }
}
