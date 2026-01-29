import { NextResponse } from "next/server";
import { db, students, studentClasses } from "@/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const validateSchema = z.object({
  nisn: z.string().min(10, "NISN harus 10 digit"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal salah (YYYY-MM-DD)"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Data tidak valid", errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { nisn, birthDate } = validation.data;

    // Find student
    const student = await db.query.students.findFirst({
      where: and(
        eq(students.nisn, nisn),
        eq(students.birthDate, birthDate),
        eq(students.isActive, true)
      ),
      with: {
        // We might need to fetch class info if relation exists, 
        // but current schema shows specific class relation might be loose or via className field.
        // Let's check schema again. students has 'className'.
      }
    });

    if (!student) {
      return NextResponse.json(
        { message: "Data siswa tidak ditemukan atau tidak aktif." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: student.id,
        fullName: student.fullName,
        nisn: student.nisn,
        className: student.className,
        parentName: student.parentName,
        schoolName: "SD Negeri ...", // Should come from settings preferably
      }
    });

  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
