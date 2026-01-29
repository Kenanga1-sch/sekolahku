import { NextResponse } from "next/server";
import { db } from "@/db";
import { alumniDocumentTypes, DEFAULT_DOCUMENT_TYPES } from "@/db/schema/alumni";
import { eq } from "drizzle-orm";

// POST /api/alumni/seed-document-types - Seed default document types
export async function POST() {
  try {
    // Check if document types already exist
    const existing = await db.select().from(alumniDocumentTypes).limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json(
        { message: "Document types already seeded", count: existing.length },
        { status: 200 }
      );
    }

    // Insert default document types
    const inserted = await db.insert(alumniDocumentTypes).values(
      DEFAULT_DOCUMENT_TYPES.map((type) => ({
        code: type.code,
        name: type.name,
        description: type.description,
        isRequired: type.isRequired,
        sortOrder: type.sortOrder,
      }))
    ).returning();

    return NextResponse.json({
      message: "Document types seeded successfully",
      count: inserted.length,
      types: inserted,
    });
  } catch (error) {
    console.error("Error seeding document types:", error);
    return NextResponse.json(
      { error: "Failed to seed document types" },
      { status: 500 }
    );
  }
}

// GET /api/alumni/seed-document-types - Check seed status
export async function GET() {
  try {
    const types = await db
      .select()
      .from(alumniDocumentTypes)
      .orderBy(alumniDocumentTypes.sortOrder);

    return NextResponse.json({
      count: types.length,
      types,
    });
  } catch (error) {
    console.error("Error fetching document types:", error);
    return NextResponse.json(
      { error: "Failed to fetch document types" },
      { status: 500 }
    );
  }
}
