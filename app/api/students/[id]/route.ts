import { NextRequest, NextResponse } from "next/server";
import { db, students } from "@/db";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/students/:id - Get student details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const student = await db.query.students.findFirst({
      where: eq(students.id, id),
    });

    if (!student) {
      return NextResponse.json(
        { error: "Peserta didik tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    return NextResponse.json(
      { error: "Failed to fetch student" },
      { status: 500 }
    );
  }
}

// PUT /api/students/:id - Update student
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      nisn,
      nis,
      fullName,
      gender,
      birthPlace,
      birthDate,
      address,
      parentName,
      parentPhone,
      className,
      photo,
      isActive,
      enrolledAt,
    } = body;

    // Check if student exists
    const existing = await db.query.students.findFirst({
      where: eq(students.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Peserta didik tidak ditemukan" },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(students)
      .set({
        nisn,
        nis,
        fullName,
        gender,
        birthPlace,
        birthDate,
        address,
        parentName,
        parentPhone,
        className,
        photo,
        isActive,
        enrolledAt: enrolledAt ? new Date(enrolledAt) : undefined,
      })
      .where(eq(students.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating student:", error);
    
    // Check for unique constraint violations
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      if (error.message.includes("nisn")) {
        return NextResponse.json(
          { error: "NISN sudah terdaftar" },
          { status: 400 }
        );
      }
      if (error.message.includes("nis")) {
        return NextResponse.json(
          { error: "NIS sudah terdaftar" },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to update student" },
      { status: 500 }
    );
  }
}

// DELETE /api/students/:id - Delete student
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if student exists
    const existing = await db.query.students.findFirst({
      where: eq(students.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Peserta didik tidak ditemukan" },
        { status: 404 }
      );
    }

    await db.delete(students).where(eq(students.id, id));

    return NextResponse.json({ success: true, message: "Peserta didik berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting student:", error);
    return NextResponse.json(
      { error: "Failed to delete student" },
      { status: 500 }
    );
  }
}
