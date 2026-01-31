
import { NextResponse } from "next/server";
import { db, studentDocuments } from "@/db";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const docs = await db
        .select()
        .from(studentDocuments)
        .where(eq(studentDocuments.studentId, id))
        .orderBy(desc(studentDocuments.uploadedAt));

    return NextResponse.json(docs);
  } catch (error) {
    return NextResponse.json({ error: "Gagal memuat dokumen" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin", "guru"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const type = formData.get("type") as any;

    if (!file) return NextResponse.json({ error: "File wajib diupload" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Prepare directory
    const uploadDir = join(process.cwd(), "public/uploads/documents/students");
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    // Generate filename
    const ext = file.name.split('.').pop();
    const filename = `${id}-${Date.now()}.${ext}`;
    const filePath = join(uploadDir, filename);

    // Write file
    await writeFile(filePath, buffer);

    // Save to DB
    const newDoc = await db.insert(studentDocuments).values({
        studentId: id,
        title: title || file.name,
        type: type || "lainnya",
        fileUrl: `/uploads/documents/students/${filename}`,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: session.user.id
    }).returning();

    return NextResponse.json(newDoc[0]);

  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "Gagal upload dokumen" }, { status: 500 });
  }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
    // This ID is actually STUDENT ID based on folder structure, wait. 
    // Usually DELETE is on /api/resource/[id]. here the route is /api/master/students/[id]/documents.
    // So DELETE here would be deleting ALL? No.
    // I should probably make a separate route /api/master/students/documents/[docId] OR handle DELETE with a query param or body on this route.
    // Best practice: Sub-resource route. /api/master/students/[id]/documents/[docId].
    // FOR NOW, to save time/files, I will accept an 'id' in the body or query param to delete a specific doc? 
    // No, that's messy. I will create a separate route for DELETE if strictly RESTful, 
    // OR I can just use a query param `docId` on DELETE.
    // NOID: docId from query param
     // Let's implement DELETE /api/master/documents/[docId] instead?
     // Or just put it here with searchParams.
     const { searchParams } = new URL(req.url);
     const docId = searchParams.get("docId");

     if (!docId) return NextResponse.json({ error: "Document ID required" }, { status: 400 });

     try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get doc to delete file
        const doc = await db.query.studentDocuments.findFirst({
            where: eq(studentDocuments.id, docId)
        });

        if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

        // Delete from DB
        await db.delete(studentDocuments).where(eq(studentDocuments.id, docId));

        // Delete file
        const filePath = join(process.cwd(), "public", doc.fileUrl);
        if (existsSync(filePath)) {
            await unlink(filePath).catch(console.error);
        }

        return NextResponse.json({ success: true });

     } catch(error) {
         return NextResponse.json({ error: "Gagal hapus dokumen" }, { status: 500 });
     }
}
