import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { spmbRegistrants } from "@/db/schema/spmb";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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
    const types = formData.getAll("types") as string[]; // Parallel array to files

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

    // Verify registrant exists and get current documents
    const existing = await db
      .select({ 
        documents: spmbRegistrants.documents,
        createdAt: spmbRegistrants.createdAt 
      })
      .from(spmbRegistrants)
      .where(eq(spmbRegistrants.id, registrantId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "Pendaftar tidak ditemukan" },
        { status: 404 }
      );
    }

    // Security Check: Upload allowed only if Admin OR Created Recently (< 1 hour)
    const session = await import("@/auth").then(m => m.auth());
    const isAdmin = ["admin", "superadmin", "panitia"].includes(session?.user?.role as string);
    
    // Check creation time
    const createdTime = existing[0].createdAt ? new Date(existing[0].createdAt).getTime() : 0;
    const isRecent = (Date.now() - createdTime) < 60 * 60 * 1000; // 1 hour

    if (!isAdmin && !isRecent) {
         return NextResponse.json(
        { success: false, error: "Sesi upload kadaluarsa. Silakan hubungi panitia." },
        { status: 403 }
      );
    }

    const savedFiles: any[] = [];
    const uploadErrors: string[] = [];

    // Process uploads
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const docType = types[i] || "other";
        
        try {
            const result = await import("@/lib/file-security").then(m => m.secureUpload(file, {
            destination: `uploads/spmb/${registrantId}`,
            allowedTypes: ["application/pdf", "image/jpeg", "image/png"],
            maxSize: 2 * 1024 * 1024, // 2MB
            }));
            
            savedFiles.push({
                path: result.url,
                type: docType,
                originalName: file.name
            });
        } catch (error) {
            uploadErrors.push(`File ${file.name}: ${error instanceof Error ? error.message : "Gagal upload"}`);
        }
    }

    if (savedFiles.length === 0 && uploadErrors.length > 0) {
       return NextResponse.json(
        { success: false, error: uploadErrors.join(", ") },
        { status: 400 }
      );
    }
    
    // Parse existing documents to append new ones
    let currentDocs: any[] = [];
    try {
      if (existing[0].documents) {
        currentDocs = JSON.parse(existing[0].documents);
        if (!Array.isArray(currentDocs)) currentDocs = [];
      }
    } catch {
      currentDocs = [];
    }

    // Update DB
    // We are now storing objects, but keeping legacy strings if they exist
    const newDocs = [...currentDocs, ...savedFiles];
    
    await db
      .update(spmbRegistrants)
      .set({ 
        documents: JSON.stringify(newDocs),
        updatedAt: new Date()
      })
      .where(eq(spmbRegistrants.id, registrantId));

    return NextResponse.json({
      success: true,
      data: {
        id: registrantId,
        documents_count: newDocs.length,
        new_files: savedFiles,
        errors: uploadErrors.length > 0 ? uploadErrors : undefined,
        uploaded_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengunggah dokumen: Internal Server Error" },
      { status: 500 }
    );
  }
}

