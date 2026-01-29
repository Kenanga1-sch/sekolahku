import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentPickups, alumniDocumentTypes } from "@/db/schema/alumni";
import { eq, desc } from "drizzle-orm";

// GET /api/alumni/[id]/pickups - List pickup history for an alumni
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const pickups = await db
      .select({
        id: documentPickups.id,
        recipientName: documentPickups.recipientName,
        recipientRelation: documentPickups.recipientRelation,
        recipientIdNumber: documentPickups.recipientIdNumber,
        recipientPhone: documentPickups.recipientPhone,
        pickupDate: documentPickups.pickupDate,
        signaturePath: documentPickups.signaturePath,
        photoProofPath: documentPickups.photoProofPath,
        notes: documentPickups.notes,
        createdAt: documentPickups.createdAt,
        documentType: {
          id: alumniDocumentTypes.id,
          name: alumniDocumentTypes.name,
          code: alumniDocumentTypes.code,
        },
      })
      .from(documentPickups)
      .leftJoin(
        alumniDocumentTypes,
        eq(documentPickups.documentTypeId, alumniDocumentTypes.id)
      )
      .where(eq(documentPickups.alumniId, id))
      .orderBy(desc(documentPickups.pickupDate));

    return NextResponse.json(pickups);
  } catch (error) {
    console.error("Error fetching pickups:", error);
    return NextResponse.json(
      { error: "Failed to fetch pickup history" },
      { status: 500 }
    );
  }
}

// POST /api/alumni/[id]/pickups - Record document pickup
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: alumniId } = await params;
    const body = await request.json();

    const {
      documentTypeId,
      recipientName,
      recipientRelation,
      recipientIdNumber,
      recipientPhone,
      pickupDate,
      signaturePath,
      photoProofPath,
      notes,
      handedOverBy,
    } = body;

    if (!recipientName) {
      return NextResponse.json(
        { error: "Recipient name is required" },
        { status: 400 }
      );
    }

    const [newPickup] = await db
      .insert(documentPickups)
      .values({
        alumniId,
        documentTypeId,
        recipientName,
        recipientRelation,
        recipientIdNumber,
        recipientPhone,
        pickupDate: pickupDate ? new Date(pickupDate) : new Date(),
        signaturePath,
        photoProofPath,
        notes,
        handedOverBy,
      })
      .returning();

    return NextResponse.json(newPickup, { status: 201 });
  } catch (error) {
    console.error("Error recording pickup:", error);
    return NextResponse.json(
      { error: "Failed to record pickup" },
      { status: 500 }
    );
  }
}
