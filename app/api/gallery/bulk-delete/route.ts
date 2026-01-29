import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { galleries } from "@/db/schema/gallery";
import { inArray, eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // 1. Fetch records to get image paths
    const records = await db.select().from(galleries).where(inArray(galleries.id, ids));

    // 2. Delete files
    const deleteFilePromises = records.map(async (record) => {
        if (record.imageUrl && record.imageUrl.startsWith("/uploads/")) {
            const filePath = path.join(process.cwd(), "public", record.imageUrl);
            try {
                await unlink(filePath);
            } catch (e) {
                console.warn(`Failed to delete file for ${record.id}:`, e);
            }
        }
    });
    
    await Promise.all(deleteFilePromises);

    // 3. Delete DB records
    await db.delete(galleries).where(inArray(galleries.id, ids));

    return NextResponse.json({ success: true, count: records.length });

  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
