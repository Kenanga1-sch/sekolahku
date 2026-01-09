import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090");

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  try {
    const registrant = await pb.collection("spmb_registrants").getOne(id, {
      expand: "period_id",
    });

    return NextResponse.json({
      success: true,
      data: registrant,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Pendaftar tidak ditemukan" },
      { status: 404 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    const validStatuses = ["pending", "verified", "accepted", "rejected"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status tidak valid" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await pb.collection("spmb_registrants").update(id, updateData);

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
  
  try {
    await pb.collection("spmb_registrants").delete(id);

    return NextResponse.json({
      success: true,
      message: "Pendaftar berhasil dihapus",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal menghapus pendaftar" },
      { status: 500 }
    );
  }
}
