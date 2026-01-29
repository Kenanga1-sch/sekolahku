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
        studentName: students.namaLengkap, // Assumes students table has namaLengkap
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
    
    // Expect body: { tpId, grades: [{ studentId, score, type }] }
    // Bulk upsert logic
    
    const { tpId, grades } = body;
    
    // SQLite doesn't have great UPSERT support in Drizzle sometimes, so we might loop
    // or delete previous for this TP/Student combination and insert new.
    
    for (const g of grades) {
        // Simple check exist
        const exist = await db.select().from(studentGrades)
            .where(and(
                eq(studentGrades.tpId, tpId),
                eq(studentGrades.studentId, g.studentId),
                eq(studentGrades.type, g.type)
            )).limit(1);
            
        if (exist.length > 0) {
            await db.update(studentGrades)
                .set({ score: g.score, updatedAt: new Date() })
                .where(eq(studentGrades.id, exist[0].id));
        } else {
            await db.insert(studentGrades).values({
                tpId,
                studentId: g.studentId,
                score: g.score,
                type: g.type,
                notes: g.notes || ""
            });
        }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
     return NextResponse.json({ success: false, error: "Failed to save grades" }, { status: 500 });
  }
}
