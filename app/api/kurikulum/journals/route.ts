import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { classJournals } from "@/db/schema/curriculum";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");

    const data = await db.select()
        .from(classJournals)
        .where(teacherId ? eq(classJournals.teacherId, teacherId) : undefined)
        .orderBy(desc(classJournals.date));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch journals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.teacherId || !body.className || !body.subject) {
        return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const inserted = await db.insert(classJournals).values({
        teacherId: body.teacherId,
        date: new Date(body.date),
        className: body.className,
        subject: body.subject,
        tpIds: body.tpIds || [],
        notes: body.notes,
        studentAttendance: body.studentAttendance || []
    }).returning();

    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error) {
     return NextResponse.json({ success: false, error: "Failed to create journal" }, { status: 500 });
  }
}
