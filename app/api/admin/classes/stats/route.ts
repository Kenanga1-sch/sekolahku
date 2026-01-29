import { NextResponse } from "next/server";
import { db, studentClasses, students } from "@/db";
import { auth } from "@/auth";
import { eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Count students per class
    // We group by class name or id
    const usage = await db
      .select({
        id: studentClasses.id,
        name: studentClasses.name,
        grade: studentClasses.grade,
        capacity: studentClasses.capacity,
        studentCount: sql<number>`count(${students.id})`,
      })
      .from(studentClasses)
      .leftJoin(students, eq(studentClasses.name, students.className))
      .groupBy(studentClasses.id);
    
    return NextResponse.json({ success: true, data: usage });
  } catch (error) {
    console.error("Error fetching class stats:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
