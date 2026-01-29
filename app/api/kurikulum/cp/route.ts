import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { curriculumCp } from "@/db/schema/curriculum";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fase = searchParams.get("fase");
    const subject = searchParams.get("subject");

    const conditions = [];
    if (fase) conditions.push(eq(curriculumCp.fase, fase as any));
    if (subject) conditions.push(eq(curriculumCp.subject, subject));

    const data = await db.select()
        .from(curriculumCp)
        .where(and(...conditions));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to fetch CP" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Allow seeding basic CP data
    const inserted = await db.insert(curriculumCp).values({
        fase: body.fase,
        subject: body.subject,
        element: body.element,
        content: body.content
    }).returning();

    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error) {
     console.error(error);
     return NextResponse.json({ success: false, error: "Failed to create CP" }, { status: 500 });
  }
}
