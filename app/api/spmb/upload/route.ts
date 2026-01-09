import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const registrantId = formData.get("registrant_id") as string;
    const documentType = formData.get("document_type") as string;
    const file = formData.get("file") as File;

    if (!registrantId || !documentType || !file) {
      return NextResponse.json(
        { success: false, error: "Semua field harus diisi" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Format file tidak didukung. Gunakan PDF, JPG, atau PNG" },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "Ukuran file maksimal 2MB" },
        { status: 400 }
      );
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

    // Update registrant with document
    // PocketBase handles file upload automatically when using FormData
    const updateData = new FormData();
    updateData.append(`document_${documentType}`, file);

    const updated = await pb.collection("spmb_registrants").update(registrantId, updateData);

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        document_type: documentType,
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
