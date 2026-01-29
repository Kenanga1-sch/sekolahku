import { requireRole } from "@/lib/auth-checks";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { spmbRegistrants, spmbPeriods } from "@/db/schema/spmb";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  const auth = await requireRole(["admin", "superadmin"]);
  if (!auth.authorized) return auth.response;
  
  try {
    const [registrant] = await db
      .select({
        registrant: spmbRegistrants,
        period: spmbPeriods,
      })
      .from(spmbRegistrants)
      .leftJoin(spmbPeriods, eq(spmbRegistrants.periodId, spmbPeriods.id))
      .where(eq(spmbRegistrants.id, id))
      .limit(1);

    if (!registrant) {
        return NextResponse.json(
            { success: false, error: "Pendaftar tidak ditemukan" },
            { status: 404 }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
          ...registrant.registrant,
          period: registrant.period
      },
    });
  } catch (error) {
    console.error("Failed to fetch registrant:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat data", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  const auth = await requireRole(["admin", "superadmin"]);
  if (!auth.authorized) return auth.response;
  
  try {
    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    const validStatuses = ["pending", "verified", "accepted", "rejected", "withdrawn"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status tidak valid" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    
    // Add updatedAt
    updateData.updatedAt = new Date();

    const [updated] = await db
        .update(spmbRegistrants)
        .set(updateData)
        .where(eq(spmbRegistrants.id, id))
        .returning();

    if (!updated) {
         return NextResponse.json(
            { success: false, error: "Update gagal, data tidak ditemukan" },
            { status: 404 }
        );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update registrant error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui data pendaftar" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  const auth = await requireRole(["admin", "superadmin"]);
  if (!auth.authorized) return auth.response;
  
  try {
    const deleted = await db.delete(spmbRegistrants).where(eq(spmbRegistrants.id, id)).returning();
    
    if (deleted.length === 0) {
        return NextResponse.json(
            { success: false, error: "Data tidak ditemukan" },
            { status: 404 }
        );
    }

    return NextResponse.json({
      success: true,
      message: "Pendaftar berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus pendaftar" },
      { status: 500 }
    );
  }
}
