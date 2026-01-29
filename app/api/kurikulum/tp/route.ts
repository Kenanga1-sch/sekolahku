import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teacherTp } from "@/db/schema/curriculum";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");
    
    // In real app, validate session user here
    
    const conditions = [];
    if (teacherId) conditions.push(eq(teacherTp.teacherId, teacherId));

    const data = await db.select()
      .from(teacherTp)
      .where(and(...conditions));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch TP" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.teacherId || !body.semester || !body.content || !body.code) {
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const inserted = await db.insert(teacherTp).values({
        teacherId: body.teacherId,
        cpId: body.cpId, // Optional
        code: body.code,
        content: body.content,
        semester: body.semester,
        subject: body.subject,
        gradeLevel: body.gradeLevel
    }).returning();

    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error) {
     console.error("TP Create Error:", error);
     return NextResponse.json({ success: false, error: "Failed to create TP" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        
        if (!body.id) {
            return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
        }

        const updated = await db.update(teacherTp)
            .set({ 
                semester: body.semester,
                gradeLevel: body.gradeLevel,
                code: body.code,
                content: body.content,
                subject: body.subject
            })
            .where(eq(teacherTp.id, body.id))
            .returning();
            
        return NextResponse.json({ success: true, data: updated[0] });
    } catch (error) {
        console.error("TP Update Error:", error);
        return NextResponse.json({ success: false, error: "Failed to update TP" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
        }

        await db.delete(teacherTp).where(eq(teacherTp.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
         return NextResponse.json({ success: false, error: "Failed to delete TP" }, { status: 500 });
    }
}
