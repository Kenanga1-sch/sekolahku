import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { galleries, NewGallery } from "@/db/schema/gallery";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { createId } from "@paralleldrive/cuid2";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const session = await import("@/auth").then(m => m.auth());
  if (!session?.user || !["admin", "superadmin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string || "general";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG, WEBP allowed." }, { status: 400 });
    }

    // Validate file size (e.g., 10MB limit before compression)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const id = createId();
    const filename = `${id}.webp`; // Always save as WebP
    const uploadDir = path.join(process.cwd(), "public", "uploads", "gallery");
    
    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });

    const filepath = path.join(uploadDir, filename);

    // Sharp Optimization:
    // 1. Resize to max width 1920px (full HD)
    // 2. Convert to WebP (better compression)
    // 3. Quality 80 (good balance)
    await sharp(buffer)
      .resize(1920, 1080, { fit: "inside", withoutEnlargement: true }) // Responsive max sizes
      .webp({ quality: 80, effort: 4 }) // Effort 4 is good speed/compression balance
      .toFile(filepath);
    
    // Optional: Generate thumbnail immediately if needed, 
    // but for now we serve the optimized WebP which is already much smaller than raw.

    const imageUrl = `/uploads/gallery/${filename}`;

    const newGallery: NewGallery = {
      title,
      description: description || null, 
      category,
      imageUrl,
    };

    const inserted = await db.insert(galleries).values(newGallery).returning();

    return NextResponse.json({ success: true, data: inserted[0] });

  } catch (error) {
    console.error("Upload error details:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
  }
}

