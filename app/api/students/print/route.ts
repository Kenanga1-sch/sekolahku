import { NextRequest, NextResponse } from "next/server";
import { db, students } from "@/db";
import { inArray } from "drizzle-orm";

// POST /api/students/print - Get multiple students for card printing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentIds } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: "Pilih setidaknya satu peserta didik" },
        { status: 400 }
      );
    }

    const studentsData = await db
      .select()
      .from(students)
      .where(inArray(students.id, studentIds));

    if (studentsData.length === 0) {
      return NextResponse.json(
        { error: "Peserta didik tidak ditemukan" },
        { status: 404 }
      );
    }

    // Helper to resolve photo URL
    const resolvePhotoUrl = (photo: string | null): string | null => {
      if (!photo) return null;
      // If already a full URL or starts with /, return as-is
      if (photo.startsWith('http') || photo.startsWith('/')) return photo;
      // Otherwise, prepend /uploads/
      return `/uploads/${photo}`;
    };

    // Return data formatted for card printing
    const cardsData = studentsData.map((student) => ({
      id: student.id,
      fullName: student.fullName,
      nisn: student.nisn,
      nis: student.nis,
      className: student.className,
      photo: resolvePhotoUrl(student.photo),
      qrCode: student.qrCode,
      gender: student.gender,
      birthPlace: student.birthPlace,
      birthDate: student.birthDate,
    }));

    return NextResponse.json({
      success: true,
      data: cardsData,
      total: cardsData.length,
    });
  } catch (error) {
    console.error("Error fetching students for printing:", error);
    return NextResponse.json(
      { error: "Failed to fetch students for printing" },
      { status: 500 }
    );
  }
}
