import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alumniDocuments } from "@/db/schema/alumni";
import { eq } from "drizzle-orm";

// POST /api/alumni/documents/[docId]/verify - Verify or reject document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const body = await request.json();

    const { status, notes, verifiedBy } = body;

    if (!status || !["verified", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be 'verified' or 'rejected'" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(alumniDocuments)
      .set({
        verificationStatus: status,
        verificationNotes: notes,
        verifiedBy,
        verifiedAt: new Date(),
      })
      .where(eq(alumniDocuments.id, docId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: `Document ${status === "verified" ? "verified" : "rejected"} successfully`,
      document: updated,
    });
  } catch (error) {
    console.error("Error verifying document:", error);
    return NextResponse.json(
      { error: "Failed to verify document" },
      { status: 500 }
    );
  }
}
