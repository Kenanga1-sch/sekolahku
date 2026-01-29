import { NextRequest, NextResponse } from "next/server";
import { db, students } from "@/db";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/auth";

interface ImportRow {
  nisn?: string;
  nis?: string;
  fullName?: string;
  nama?: string; // Alternative column name
  "Nama Lengkap"?: string;
  "NISN"?: string;
  "NIS"?: string;
  gender?: string;
  "Jenis Kelamin"?: string;
  className?: string;
  kelas?: string;
  "Kelas"?: string;
  birthPlace?: string;
  "Tempat Lahir"?: string;
  birthDate?: string;
  "Tanggal Lahir"?: string;
  address?: string;
  alamat?: string;
  "Alamat"?: string;
  parentName?: string;
  "Nama Orang Tua"?: string;
  parentPhone?: string;
  "No HP Orang Tua"?: string;
}

// POST /api/students/import
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    
    // Import xlsx dynamically
    const XLSX = await import("xlsx");
    
    // Parse workbook
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rawData: ImportRow[] = XLSX.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return NextResponse.json({ 
        error: "File kosong atau format tidak valid" 
      }, { status: 400 });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { row: number; name: string; error: string }[],
    };

    // Process each row
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2; // Excel row number (1-indexed + header)

      try {
        // Extract values with fallbacks for different column names
        const fullName = row.fullName || row.nama || row["Nama Lengkap"] || "";
        const nisn = row.nisn || row["NISN"] || null;
        const nis = row.nis || row["NIS"] || null;
        const gender = normalizeGender(row.gender || row["Jenis Kelamin"]);
        const className = row.className || row.kelas || row["Kelas"] || null;
        const birthPlace = row.birthPlace || row["Tempat Lahir"] || null;
        const birthDate = normalizeBirthDate(row.birthDate || row["Tanggal Lahir"]);
        const address = row.address || row.alamat || row["Alamat"] || null;
        const parentName = row.parentName || row["Nama Orang Tua"] || null;
        const parentPhone = row.parentPhone || row["No HP Orang Tua"] || null;

        if (!fullName.trim()) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            name: "-",
            error: "Nama lengkap wajib diisi",
          });
          continue;
        }

        // Generate QR code
        const qrCode = `STU-${createId()}`;

        // Insert to database
        await db.insert(students).values({
          nisn: nisn?.toString().trim() || null,
          nis: nis?.toString().trim() || null,
          fullName: fullName.trim(),
          gender,
          className: className?.toString().trim() || null,
          birthPlace: birthPlace?.toString().trim() || null,
          birthDate: birthDate,
          address: address?.toString().trim() || null,
          parentName: parentName?.toString().trim() || null,
          parentPhone: parentPhone?.toString().trim() || null,
          qrCode,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        results.success++;
      } catch (error: any) {
        results.failed++;
        const name = row.fullName || row.nama || row["Nama Lengkap"] || "-";
        
        // Check for duplicate errors
        if (error.message?.includes("UNIQUE constraint failed")) {
          if (error.message.includes("nisn")) {
            results.errors.push({
              row: rowNum,
              name,
              error: "NISN sudah terdaftar",
            });
          } else if (error.message.includes("nis")) {
            results.errors.push({
              row: rowNum,
              name,
              error: "NIS sudah terdaftar",
            });
          } else {
            results.errors.push({
              row: rowNum,
              name,
              error: "Data duplikat",
            });
          }
        } else {
          results.errors.push({
            row: rowNum,
            name,
            error: error.message || "Gagal menyimpan data",
          });
        }
      }
    }

    return NextResponse.json({
      message: `Import selesai: ${results.success} berhasil, ${results.failed} gagal`,
      ...results,
    });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengimport data" },
      { status: 500 }
    );
  }
}

// Helper to normalize gender values
function normalizeGender(value: string | undefined): "L" | "P" | null {
  if (!value) return null;
  const v = value.toString().trim().toLowerCase();
  if (v === "l" || v === "laki-laki" || v === "laki" || v === "m" || v === "male") {
    return "L";
  }
  if (v === "p" || v === "perempuan" || v === "wanita" || v === "f" || v === "female") {
    return "P";
  }
  return null;
}

// Helper to normalize birth date
function normalizeBirthDate(value: string | undefined): string | null {
  if (!value) return null;
  
  // If it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  
  // Try to parse various formats
  try {
    // Handle Excel date serial number
    if (typeof value === "number") {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    }
    
    // Handle DD/MM/YYYY or DD-MM-YYYY
    const parts = value.split(/[\/\-]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      if (day.length <= 2 && month.length <= 2) {
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }
    
    // Try Date parsing
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  } catch {
    // Ignore parsing errors
  }
  
  return null;
}
