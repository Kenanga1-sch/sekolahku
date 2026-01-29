import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alumniDocuments } from "@/db/schema/alumni";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// GET /api/alumni/documents/[docId]/download - Download document file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;

    const [document] = await db
      .select()
      .from(alumniDocuments)
      .where(eq(alumniDocuments.id, docId))
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Construct full file path
    const relativePath = document.filePath.startsWith("/api/")
      ? document.filePath.replace("/api/", "")
      : document.filePath;
    
    // Remove leading slash if present to ensure proper join with cwd
    const cleanPath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
    
    const filePath = path.join(process.cwd(), cleanPath);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found on server" },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${document.fileName}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (error) {
    console.error("Error downloading document:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}
