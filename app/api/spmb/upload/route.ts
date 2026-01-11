import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090");

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const registrantId = searchParams.get("id");

    if (!registrantId) {
      return NextResponse.json(
        { success: false, error: "ID pendaftar diperlukan" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("documents") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada file yang diunggah" },
        { status: 400 }
      );
    }

    // Validate file types and sizes
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    const maxSize = 2 * 1024 * 1024; // 2MB

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: `Format file ${file.name} tidak didukung. Gunakan PDF, JPG, atau PNG` },
          { status: 400 }
        );
      }
      if (file.size > maxSize) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} melebihi ukuran maksimal 2MB` },
          { status: 400 }
        );
      }
    }

    // Verify registrant exists
    try {
      await pb.collection("spmb_registrants").getOne(registrantId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Pendaftar tidak ditemukan" },
        { status: 404 }
      );
    }

    // Update registrant with documents
    const updateData = new FormData();
    files.forEach((file) => {
      updateData.append("documents", file);
    });

    const updated = await pb.collection("spmb_registrants").update(registrantId, updateData);

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        documents_count: files.length,
        uploaded_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengunggah dokumen" },
      { status: 500 }
    );
  }
}

