import { db } from "@/db";
import { letterTemplates } from "@/db/schema/letters";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { desc, like, or } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    const conditions = [];
    if (query) {
      conditions.push(like(letterTemplates.name, `%${query}%`));
    }

    const data = await db
      .select({
         id: letterTemplates.id,
         name: letterTemplates.name,
         category: letterTemplates.category,
         updatedAt: letterTemplates.updatedAt
      })
      .from(letterTemplates)
      .where(conditions.length > 0 ? or(...conditions) : undefined)
      .orderBy(desc(letterTemplates.updatedAt));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let name, content, category, paperSize, orientation, filePath, type;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name = formData.get("name") as string;
      category = formData.get("category") as string;
      paperSize = formData.get("paperSize") as string;
      orientation = formData.get("orientation") as string;
      
      const file = formData.get("file") as File;
      if (file) {
        type = "UPLOAD";
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Save file
        type = "UPLOAD";
        filePath = `/uploads/templates/${Date.now()}-${file.name.replace(/\s/g, "_")}`;
        const fs = require("fs");
        const path = require("path");
        const uploadDir = path.join(process.cwd(), "public/uploads/templates");
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        fs.writeFileSync(path.join(process.cwd(), "public", filePath), buffer);
        
        // Capture content (variables JSON) from formData if available
        const formDataContent = formData.get("content") as string;
        content = formDataContent || ""; 
      } else {
         // Fallback if no file in form data (should not happen for upload type)
         content = formData.get("content") as string;
         type = "EDITOR";
      }
    } else {
      const body = await req.json();
      name = body.name;
      content = body.content;
      category = body.category;
      paperSize = body.paperSize;
      orientation = body.orientation;
      type = "EDITOR";
    }

    if (!name || (type === "EDITOR" && !content)) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const [newTemplate] = await db.insert(letterTemplates).values({
      name,
      content: content || "",
      category: category || "GENERAL",
      paperSize: paperSize || "A4",
      orientation: orientation || "portrait",
      filePath: filePath || null,
      type: type || "EDITOR"
    }).returning();

    return NextResponse.json({ data: newTemplate });
  } catch (error) {
    console.error("Failed to create template:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
