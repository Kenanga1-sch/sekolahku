import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { galleries } from "@/db/schema/gallery";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const record = await db.query.galleries.findFirst({
        where: eq(galleries.id, id)
    });

    if (!record) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Delete file
    if (record.imageUrl && record.imageUrl.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), "public", record.imageUrl);
        try {
            await unlink(filePath);
        } catch (e) {
            console.error("Error deleting file:", e);
            // Continue to delete record even if file delete fails (e.g. file missing)
        }
    }

    await db.delete(galleries).where(eq(galleries.id, id));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, category } = body;

    const record = await db.query.galleries.findFirst({
        where: eq(galleries.id, id)
    });

    if (!record) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    await db.update(galleries)
        .set({ 
            title: title || record.title,
            category: category || record.category,
            updatedAt: new Date(),
        })
        .where(eq(galleries.id, id));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
