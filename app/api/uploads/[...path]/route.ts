import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Serve files from uploads directory
// GET /api/uploads/[...path] - e.g., /api/uploads/alumni/abc123/IJAZAH/file.pdf
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Construct full file path
    const relativePath = pathSegments.join("/");
    const filePath = path.join(process.cwd(), "uploads", relativePath);

    // Security check: ensure path is within uploads directory
    const uploadsDir = path.join(process.cwd(), "uploads");
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);

    // Determine content type based on extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = contentTypes[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
