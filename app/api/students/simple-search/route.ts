import { db } from "@/db";
import { students, studentClasses } from "@/db/schema/students";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { like, or, and, eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const className = searchParams.get("className");

    // If no query, return recent 20 students
    const filters = [];
    if (q) filters.push(or(like(students.fullName, `%${q}%`), like(students.nisn, `%${q}%`)));
    if (className) filters.push(eq(students.className, className));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    
    // Higher limit if searching by class
    const limit = className ? 100 : 20;

    const data = await db
      .select({
         id: students.id,
         name: students.fullName,
         nisn: students.nisn,
         nis: students.nis,
         className: students.className,
         gender: students.gender,
         birthPlace: students.birthPlace,
         birthDate: students.birthDate,
         address: students.address,
         parentName: students.parentName,
         parentPhone: students.parentPhone,
      })
      .from(students)
      .where(whereClause)
      .limit(limit);

    return NextResponse.json({ data });
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
