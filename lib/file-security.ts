import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { createId } from "@paralleldrive/cuid2";

export interface UploadOptions {
  destination: string;
  allowedTypes: string[];
  maxSize: number; // bytes
  filename?: string; // Optional custom filename
  preserveOriginalName?: boolean; // NOT RECOMMENDED for security
}

export interface UploadResult {
  filepath: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * Validates and saves an uploaded file securely.
 */
export async function secureUpload(
  file: File,
  options: UploadOptions
): Promise<UploadResult> {
  // 1. Validate Size
  if (file.size > options.maxSize) {
    throw new Error(
      `File too large. Maximum size is ${Math.round(options.maxSize / 1024 / 1024)}MB.`
    );
  }

  // 2. Validate MIME Type (Basic Check)
  // Note: For critical security, use a library like 'file-type' to check magic numbers.
  // Here we rely on strict whitelisting and renaming.
  if (!options.allowedTypes.includes(file.type)) {
    throw new Error(
      `Invalid file type: ${file.type}. Allowed: ${options.allowedTypes.join(", ")}`
    );
  }

  // 3. Prepare Directory
  const uploadDir = path.join(process.cwd(), "public", options.destination);
  await mkdir(uploadDir, { recursive: true });

  // 4. Generate Safe Filename
  // We prefer generating a random ID to prevent path traversal and overwrites.
  const ext = getExtensionFromMimeType(file.type) || path.extname(file.name).slice(1);
  const safeFilename = options.filename 
    ? `${options.filename}.${ext}`
    : `${createId()}.${ext}`;
    
  // 5. Save File
  const buffer = Buffer.from(await file.arrayBuffer());
  const finalPath = path.join(uploadDir, safeFilename);
  
  await writeFile(finalPath, buffer);

  return {
    filepath: finalPath,
    filename: safeFilename,
    url: `/${options.destination}/${safeFilename}`.replace(/\\/g, "/").replace("//", "/"),
    size: file.size,
    mimeType: file.type,
  };
}

function getExtensionFromMimeType(mimeType: string): string | null {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
  };
  return map[mimeType] || null;
}
