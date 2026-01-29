import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { p5Projects } from "@/db/schema/curriculum";

export async function GET(req: NextRequest) {
  try {
    const data = await db.select().from(p5Projects);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inserted = await db.insert(p5Projects).values({
        theme: body.theme,
        title: body.title,
        description: body.description,
        dimensions: body.dimensions,
        gradeLevel: body.gradeLevel,
        semester: body.semester
    }).returning();
    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error) {
     return NextResponse.json({ success: false, error: "Failed to create project" }, { status: 500 });
  }
}
