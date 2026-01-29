import { db } from "@/db";
import { announcements } from "@/db/schema/misc";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await auth();
    if (!session?.user || !["admin", "superadmin", "staff"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    
    const updateData: Record<string, any> = {};
    
    if (body.title !== undefined) updateData.title = body.title;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.thumbnail !== undefined) updateData.thumbnail = body.thumbnail;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.is_published !== undefined) {
      updateData.isPublished = body.is_published;
      updateData.publishedAt = body.is_published ? new Date() : null;
    }
    if (body.is_featured !== undefined) updateData.isFeatured = body.is_featured;



    await db.update(announcements).set(updateData).where(eq(announcements.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update announcement:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.delete(announcements).where(eq(announcements.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
