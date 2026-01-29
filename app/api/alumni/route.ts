
import { NextRequest, NextResponse } from "next/server";
import { db, students } from "@/db"; // Use students table
import { eq, desc, like, or, sql, count, and } from "drizzle-orm";
import { auth } from "@/auth";

// GET /api/alumni - List all alumni (students where status='graduated')
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    // if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    // const graduationYear = searchParams.get("graduationYear") || ""; 
    
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [eq(students.status, "graduated")]; 

    if (search) {
      whereConditions.push(
        or(
          like(students.fullName, `%${search}%`),
          like(students.nisn, `%${search}%`),
          like(students.nis, `%${search}%`)
        )
      );
    }

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(students)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Get paginated results
    const results = await db
      .select({
        id: students.id,
        nisn: students.nisn,
        nis: students.nis,
        fullName: students.fullName,
        gender: students.gender,
        // Map fields that don't exist directly
        graduationYear: sql<string>`strftime('%Y', ${students.updatedAt})`, 
        finalClass: students.className, 
        photo: students.photo,
        nextSchool: sql<string>`json_extract(${students.metaData}, '$.nextSchool')`, 
        createdAt: students.createdAt,
      })
      .from(students)
      .where(and(...whereConditions))
      .orderBy(desc(students.updatedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: results.map(r => ({
          ...r,
          graduationYear: r.graduationYear || "-", 
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching alumni:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
    return NextResponse.json({ error: "Use Master Student Directory to add alumni" }, { status: 400 });
}
