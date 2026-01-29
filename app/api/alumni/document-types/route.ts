import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alumniDocumentTypes } from "@/db/schema/alumni";
import { eq, asc } from "drizzle-orm";

// GET /api/alumni/document-types - List all document types
export async function GET() {
  try {
    const types = await db
      .select()
      .from(alumniDocumentTypes)
      .where(eq(alumniDocumentTypes.isActive, true))
      .orderBy(asc(alumniDocumentTypes.sortOrder));

    return NextResponse.json(types);
  } catch (error) {
    console.error("Error fetching document types:", error);
    return NextResponse.json(
      { error: "Failed to fetch document types" },
      { status: 500 }
    );
  }
}

// POST /api/alumni/document-types - Create new document type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, code, description, isRequired, maxFileSizeMb, allowedTypes, sortOrder } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    const [newType] = await db
      .insert(alumniDocumentTypes)
      .values({
        name,
        code: code.toUpperCase(),
        description,
        isRequired: isRequired || false,
        maxFileSizeMb: maxFileSizeMb || 5,
        allowedTypes: JSON.stringify(allowedTypes || ["application/pdf", "image/jpeg", "image/png"]),
        sortOrder: sortOrder || 0,
      })
      .returning();

    return NextResponse.json(newType, { status: 201 });
  } catch (error) {
    console.error("Error creating document type:", error);
    return NextResponse.json(
      { error: "Failed to create document type" },
      { status: 500 }
    );
  }
}
