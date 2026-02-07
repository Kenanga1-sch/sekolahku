import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { libraryCatalog } from "@/db/schema/library";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const session = await import("@/auth").then(m => m.auth());
  if (!session?.user || !["admin", "superadmin", "petugas"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const isbn = formData.get("isbn") as string;
    const catalogId = formData.get("catalogId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG, WEBP allowed." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create filename based on ISBN or Catalog ID
    const filename = `${isbn || catalogId || Date.now()}.webp`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "library", "covers");
    
    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });

    const filepath = path.join(uploadDir, filename);

    // Sharp Optimization:
    // Resize to reasonable size for covers (e.g. 800px width)
    await sharp(buffer)
      .resize(800, null, { withoutEnlargement: true }) 
      .webp({ quality: 80 })
      .toFile(filepath);
    
    const imageUrl = `/uploads/library/covers/${filename}`;

    if (catalogId) {
        await db.update(libraryCatalog)
            .set({ cover: imageUrl, updatedAt: new Date() } as any)
            .where(eq(libraryCatalog.id, catalogId));
        
        const { revalidateLibraryStats } = await import("@/lib/data/library");
        await revalidateLibraryStats();
    }

    return NextResponse.json({ 
        success: true, 
        url: imageUrl 
    });

  } catch (error) {
    console.error("Library cover upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
