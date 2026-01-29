import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema/students";
import { eq, like, and, desc, sql, count } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const className = searchParams.get("className");
    const isActiveStr = searchParams.get("isActive"); // "true", "false", or "all"

    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    
    if (search) {
      conditions.push(
        sql`(${students.fullName} LIKE ${`%${search}%`} OR ${students.nisn} LIKE ${`%${search}%`} OR ${students.nis} LIKE ${`%${search}%`})`
      );
    }
    
    if (className && className !== "all") {
      conditions.push(eq(students.className, className));
    }

    if (isActiveStr && isActiveStr !== "all") {
       conditions.push(eq(students.isActive, isActiveStr === "true"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Get Data with Pagination
    const data = await db
      .select()
      .from(students)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(students.createdAt));

    // 2. Get Total Count (for pagination)
    const [totalObj] = await db
      .select({ count: count() })
      .from(students)
      .where(whereClause);
    const total = totalObj?.count || 0;

    // 3. Get Summary Stats (Global - ignore filters mostly, or maybe respect them? Usually summary is global or at least reflects current view context)
    // For this UI, the "Total Siswa", "Siswa Aktif" cards usually imply GLOBAL stats, 
    // while the table is filtered. But "byClass" is needed for the filter dropdown.
    // Let's get global summary.

    const [globalStats] = await db
        .select({
            total: count(),
            active: sql<number>`sum(case when ${students.isActive} = 1 then 1 else 0 end)`
        })
        .from(students);

    // Group by class for the filter dropdown and charts
    const byClassData = await db
        .select({
            className: students.className,
            count: count()
        })
        .from(students)
        .groupBy(students.className)
        .orderBy(students.className);

    // Response
    return NextResponse.json({
      data: data.map(s => ({
          ...s,
          // Ensure nulls are handled if needed, though schema usually handles it
          nisn: s.nisn || null,
          nis: s.nis || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        total: globalStats?.total || 0,
        active: Number(globalStats?.active) || 0,
        byClass: byClassData
      }
    });

  } catch (error) {
    console.error("Failed to fetch students:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
