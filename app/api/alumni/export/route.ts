import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alumni } from "@/db/schema/alumni";
import { desc, like, or, eq, sql } from "drizzle-orm";

// GET /api/alumni/export - Export alumni data as CSV
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const graduationYear = searchParams.get("graduationYear") || "";
    const format = searchParams.get("format") || "csv";

    // Build where conditions
    let whereCondition = undefined;
    if (graduationYear) {
      whereCondition = eq(alumni.graduationYear, graduationYear);
    }

    // Fetch all alumni data
    const alumniData = await db
      .select()
      .from(alumni)
      .where(whereCondition)
      .orderBy(desc(alumni.graduationYear), alumni.fullName);

    if (format === "json") {
      return NextResponse.json(alumniData);
    }

    // Generate CSV
    const headers = [
      "NISN",
      "NIS",
      "Nama Lengkap",
      "Jenis Kelamin",
      "Tempat Lahir",
      "Tanggal Lahir",
      "Tahun Lulus",
      "Kelas Terakhir",
      "Nama Orang Tua",
      "Telepon Orang Tua",
      "Alamat",
      "Telepon Alumni",
      "Email Alumni",
      "Sekolah Lanjutan",
      "Catatan",
    ];

    const rows = alumniData.map((a) => [
      a.nisn || "",
      a.nis || "",
      a.fullName,
      a.gender === "L" ? "Laki-laki" : a.gender === "P" ? "Perempuan" : "",
      a.birthPlace || "",
      a.birthDate || "",
      a.graduationYear,
      a.finalClass || "",
      a.parentName || "",
      a.parentPhone || "",
      a.currentAddress || "",
      a.currentPhone || "",
      a.currentEmail || "",
      a.nextSchool || "",
      a.notes || "",
    ]);

    // Escape CSV fields
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    // Add BOM for Excel compatibility with UTF-8
    const bom = "\uFEFF";
    const csvWithBom = bom + csvContent;

    return new NextResponse(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="alumni_${graduationYear || "all"}_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting alumni:", error);
    return NextResponse.json(
      { error: "Failed to export alumni data" },
      { status: 500 }
    );
  }
}
