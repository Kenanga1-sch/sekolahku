import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alumniDocuments } from "@/db/schema/alumni";
import { eq } from "drizzle-orm";

// GET /api/alumni/documents/[docId] - Get document details
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

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// PUT /api/alumni/documents/[docId] - Update document
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const body = await request.json();

    const { documentNumber, issueDate, notes } = body;

    const [updated] = await db
      .update(alumniDocuments)
      .set({
        documentNumber,
        issueDate,
        notes,
      })
      .where(eq(alumniDocuments.id, docId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

// DELETE /api/alumni/documents/[docId] - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;

    const [deleted] = await db
      .delete(alumniDocuments)
      .where(eq(alumniDocuments.id, docId))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Optionally delete file from storage
    // await unlink(deletedFilePath)

    return NextResponse.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
