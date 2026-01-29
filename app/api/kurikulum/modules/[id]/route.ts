import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teachingModules, teacherTp } from "@/db/schema/curriculum";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await db.select()
        .from(teachingModules)
        .where(eq(teachingModules.id, params.id))
        .limit(1);

    if (data.length === 0) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    
    // Fetch associated TP details for context
    const tp = await db.select().from(teacherTp).where(eq(teacherTp.id, data[0].tpId)).limit(1);

    return NextResponse.json({ success: true, data: { ...data[0], tp: tp[0] } });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const updated = await db.update(teachingModules)
            .set({
                topic: body.topic,
                activities: body.activities,
                allocationMap: body.allocationMap,
                assessmentPlan: body.assessmentPlan,
                mediaLinks: body.mediaLinks,
                status: body.status,
                updatedAt: new Date()
            })
            .where(eq(teachingModules.id, params.id))
            .returning();
            
        return NextResponse.json({ success: true, data: updated[0] });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        await db.delete(teachingModules).where(eq(teachingModules.id, params.id));
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
    }
}
