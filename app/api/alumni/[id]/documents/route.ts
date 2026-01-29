import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alumniDocuments, alumniDocumentTypes } from "@/db/schema/alumni";
import { eq, and } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { createId } from "@paralleldrive/cuid2";

// GET /api/alumni/[id]/documents - List documents for an alumni
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const documents = await db
      .select({
        id: alumniDocuments.id,
        fileName: alumniDocuments.fileName,
        filePath: alumniDocuments.filePath,
        fileSize: alumniDocuments.fileSize,
        mimeType: alumniDocuments.mimeType,
        documentNumber: alumniDocuments.documentNumber,
        issueDate: alumniDocuments.issueDate,
        verificationStatus: alumniDocuments.verificationStatus,
        verifiedAt: alumniDocuments.verifiedAt,
        notes: alumniDocuments.notes,
        createdAt: alumniDocuments.createdAt,
        documentType: {
          id: alumniDocumentTypes.id,
          name: alumniDocumentTypes.name,
          code: alumniDocumentTypes.code,
        },
      })
      .from(alumniDocuments)
      .leftJoin(
        alumniDocumentTypes,
        eq(alumniDocuments.documentTypeId, alumniDocumentTypes.id)
      )
      .where(eq(alumniDocuments.alumniId, id));

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST /api/alumni/[id]/documents - Upload document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: alumniId } = await params;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const documentTypeId = formData.get("documentTypeId") as string;
    const documentNumber = formData.get("documentNumber") as string | null;
    const issueDate = formData.get("issueDate") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    if (!documentTypeId) {
      return NextResponse.json(
        { error: "Document type is required" },
        { status: 400 }
      );
    }

    // Get document type for validation
    const [docType] = await db
      .select()
      .from(alumniDocumentTypes)
      .where(eq(alumniDocumentTypes.id, documentTypeId))
      .limit(1);

    if (!docType) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    // Validate file size
    const maxSizeBytes = (docType.maxFileSizeMb || 5) * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `File size exceeds ${docType.maxFileSizeMb || 5}MB limit` },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = JSON.parse(docType.allowedTypes || '["application/pdf","image/jpeg","image/png"]');
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), "uploads", "alumni", alumniId, docType.code);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExt = path.extname(file.name);
    const uniqueFileName = `${createId()}${fileExt}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    const relativePath = `/api/uploads/alumni/${alumniId}/${docType.code}/${uniqueFileName}`;

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save to database
    const [newDocument] = await db
      .insert(alumniDocuments)
      .values({
        alumniId,
        documentTypeId,
        fileName: file.name,
        filePath: relativePath,
        fileSize: file.size,
        mimeType: file.type,
        documentNumber,
        issueDate,
        notes,
        verificationStatus: "pending",
      })
      .returning();

    return NextResponse.json(newDocument, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
