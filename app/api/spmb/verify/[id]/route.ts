import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { spmbRegistrants, spmbPeriods } from "@/db/schema/spmb";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const [result] = await db
      .select({
        id: spmbRegistrants.id,
        registrationNumber: spmbRegistrants.registrationNumber,
        fullName: spmbRegistrants.fullName,
        studentNik: spmbRegistrants.studentNik,
        status: spmbRegistrants.status,
        createdAt: spmbRegistrants.createdAt,
        verifiedAt: spmbRegistrants.verifiedAt,
        periodName: spmbPeriods.name,
        academicYear: spmbPeriods.academicYear,
      })
      .from(spmbRegistrants)
      .leftJoin(spmbPeriods, eq(spmbRegistrants.periodId, spmbPeriods.id))
      .where(eq(spmbRegistrants.id, id))
      .limit(1);

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Dokumen tidak ditemukan atau tidak valid" },
        { status: 404 }
      );
    }

    // Security: Mask NIK (Show first 4 and last 4)
    // Example: 3212012012000001 -> 3212********0001
    const maskedNik = result.studentNik.length > 8 
      ? `${result.studentNik.substring(0, 4)}********${result.studentNik.substring(result.studentNik.length - 4)}`
      : result.studentNik;

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        studentNik: maskedNik,
        // Helper boolean for frontend
        isValid: true
      },
    });
  } catch (error) {
    console.error("Verification API Error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan sistem saat memverifikasi data" },
      { status: 500 }
    );
  }
}
