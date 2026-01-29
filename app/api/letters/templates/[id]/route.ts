import { db } from "@/db";
import { letterTemplates } from "@/db/schema/letters";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const [template] = await db
      .select()
      .from(letterTemplates)
      .where(eq(letterTemplates.id, params.id))
      .limit(1);

    if (!template) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Failed to fetch template:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let updateData: any = {};

    if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        if (formData.has("name")) updateData.name = formData.get("name") as string;
        if (formData.has("category")) updateData.category = formData.get("category") as string;
        if (formData.has("paperSize")) updateData.paperSize = formData.get("paperSize") as string;
        if (formData.has("orientation")) updateData.orientation = formData.get("orientation") as string;
        if (formData.has("content")) updateData.content = formData.get("content") as string;

        const file = formData.get("file") as File;
        if (file) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            
            // Save file
            const fileName = `/uploads/templates/${Date.now()}-${file.name.replace(/\s/g, "_")}`;
            const fs = require("fs");
            const path = require("path");
            const uploadDir = path.join(process.cwd(), "public/uploads/templates");
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            fs.writeFileSync(path.join(process.cwd(), "public", fileName), buffer);
            
            updateData.filePath = fileName;
            updateData.type = "UPLOAD";
            updateData.filePath = fileName;
            updateData.type = "UPLOAD";
            // Content is already set from formData (JSON variables)
            // Do not clear it explicitly
        }
    } else {
        updateData = await req.json();
    }
    
    // Validate current existence
    const [existing] = await db
        .select()
        .from(letterTemplates)
        .where(eq(letterTemplates.id, params.id));
        
    if (!existing) {
        return new NextResponse("Not Found", { status: 404 });
    }

    const [updated] = await db
      .update(letterTemplates)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(letterTemplates.id, params.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update template:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await db.delete(letterTemplates).where(eq(letterTemplates.id, params.id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
