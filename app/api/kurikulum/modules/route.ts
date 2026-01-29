import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teachingModules, teacherTp } from "@/db/schema/curriculum";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");

    // In a real app, join with teacherTp to verify ownership or use session
    // For now, we fetch modules where the related TP belongs to the teacher (if we joined)
    // Or simpler: fetch all modules for TPs that belong to this teacher.
    
    // SQLite Drizzle Join
    const data = await db.select({
        id: teachingModules.id,
        topic: teachingModules.topic,
        status: teachingModules.status,
        updatedAt: teachingModules.updatedAt,
        tpCode: teacherTp.code,
        subject: teacherTp.subject,
        grade: teacherTp.gradeLevel
    })
    .from(teachingModules)
    .leftJoin(teacherTp, eq(teachingModules.tpId, teacherTp.id))
    .where(teacherId ? eq(teacherTp.teacherId, teacherId) : undefined)
    .orderBy(desc(teachingModules.updatedAt));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to fetch modules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate
    if (!body.tpId || !body.topic) {
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const inserted = await db.insert(teachingModules).values({
        tpId: body.tpId,
        topic: body.topic,
        activities: body.activities, // JSON object
        allocationMap: body.allocationMap,
        assessmentPlan: body.assessmentPlan,
        mediaLinks: body.mediaLinks,
        status: body.status || "DRAFT"
    }).returning();

    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error) {
     console.error("Module Create Error:", error);
     return NextResponse.json({ success: false, error: "Failed to create module" }, { status: 500 });
  }
}
