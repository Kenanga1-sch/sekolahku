import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alumni, alumniDocuments, documentPickups, alumniDocumentTypes } from "@/db/schema/alumni";
import { eq } from "drizzle-orm";

// GET /api/alumni/[id] - Get single alumni with documents and pickups
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get alumni basic info
    const alumniResult = await db
      .select()
      .from(alumni)
      .where(eq(alumni.id, id))
      .limit(1);

    if (alumniResult.length === 0) {
      return NextResponse.json(
        { error: "Alumni not found" },
        { status: 404 }
      );
    }

    const alumniData = alumniResult[0];

    // Get documents with type info
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
      .leftJoin(alumniDocumentTypes, eq(alumniDocuments.documentTypeId, alumniDocumentTypes.id))
      .where(eq(alumniDocuments.alumniId, id));

    // Get pickup history
    const pickups = await db
      .select({
        id: documentPickups.id,
        recipientName: documentPickups.recipientName,
        recipientRelation: documentPickups.recipientRelation,
        pickupDate: documentPickups.pickupDate,
        notes: documentPickups.notes,
        documentType: {
          id: alumniDocumentTypes.id,
          name: alumniDocumentTypes.name,
          code: alumniDocumentTypes.code,
        },
      })
      .from(documentPickups)
      .leftJoin(alumniDocumentTypes, eq(documentPickups.documentTypeId, alumniDocumentTypes.id))
      .where(eq(documentPickups.alumniId, id));

    return NextResponse.json({
      ...alumniData,
      documents,
      pickups,
    });
  } catch (error) {
    console.error("Error fetching alumni:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni" },
      { status: 500 }
    );
  }
}

// PUT /api/alumni/[id] - Update alumni
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if alumni exists
    const existing = await db
      .select()
      .from(alumni)
      .where(eq(alumni.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Alumni not found" },
        { status: 404 }
      );
    }

    const {
      nisn,
      nis,
      fullName,
      gender,
      birthPlace,
      birthDate,
      graduationYear,
      graduationDate,
      finalClass,
      photo,
      parentName,
      parentPhone,
      currentAddress,
      currentPhone,
      currentEmail,
      nextSchool,
      notes,
    } = body;

    const updated = await db
      .update(alumni)
      .set({
        nisn,
        nis,
        fullName,
        gender,
        birthPlace,
        birthDate,
        graduationYear,
        graduationDate: graduationDate ? new Date(graduationDate) : undefined,
        finalClass,
        photo,
        parentName,
        parentPhone,
        currentAddress,
        currentPhone,
        currentEmail,
        nextSchool,
        notes,
      })
      .where(eq(alumni.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Error updating alumni:", error);
    return NextResponse.json(
      { error: "Failed to update alumni" },
      { status: 500 }
    );
  }
}

// DELETE /api/alumni/[id] - Delete alumni
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete alumni (cascade will handle documents and pickups)
    const deleted = await db
      .delete(alumni)
      .where(eq(alumni.id, id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Alumni not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Alumni deleted successfully" });
  } catch (error) {
    console.error("Error deleting alumni:", error);
    return NextResponse.json(
      { error: "Failed to delete alumni" },
      { status: 500 }
    );
  }
}
