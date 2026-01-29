import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) { // Allow authenticated users (admins/staff)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = formData.get("folder") as string || "uploads";
    
    // Validate folder name to prevent directory traversal
    if (folder.includes(".") || folder.includes("/") || folder.includes("\\")) {
       return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const result = await import("@/lib/file-security").then(m => m.secureUpload(file, {
        destination: `uploads/${folder}`,
        // Strict whitelist for general uploads
        allowedTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        maxSize: 5 * 1024 * 1024, // 5MB limit
    }));

    return NextResponse.json({ 
      success: true, 
      url: result.url 
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error uploading file" },
      { status: 500 }
    );
  }
}
