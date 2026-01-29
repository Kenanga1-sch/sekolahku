import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alumni } from "@/db/schema/alumni";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { createId } from "@paralleldrive/cuid2";

// POST /api/alumni/[id]/photo - Upload alumni photo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: alumniId } = await params;

    const formData = await request.formData();
    const file = formData.get("photo") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Photo file is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Photo size must be less than 2MB" },
        { status: 400 }
      );
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), "uploads", "alumni", alumniId, "photo");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExt = path.extname(file.name);
    const uniqueFileName = `${createId()}${fileExt}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    const relativePath = `/api/uploads/alumni/${alumniId}/photo/${uniqueFileName}`;

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Update alumni record with photo path
    const [updated] = await db
      .update(alumni)
      .set({ photo: relativePath })
      .where(eq(alumni.id, alumniId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Alumni not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Photo uploaded successfully",
      photo: relativePath,
    });
  } catch (error) {
    console.error("Error uploading photo:", error);
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    );
  }
}

// DELETE /api/alumni/[id]/photo - Remove alumni photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: alumniId } = await params;

    const [updated] = await db
      .update(alumni)
      .set({ photo: null })
      .where(eq(alumni.id, alumniId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Alumni not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Photo removed successfully" });
  } catch (error) {
    console.error("Error removing photo:", error);
    return NextResponse.json(
      { error: "Failed to remove photo" },
      { status: 500 }
    );
  }
}
