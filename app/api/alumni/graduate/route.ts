import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alumni } from "@/db/schema/alumni";
import { students } from "@/db/schema/students";
import { eq, inArray } from "drizzle-orm";

// POST /api/alumni/graduate - Batch graduate students to alumni
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { studentIds, graduationYear, graduationDate, deactivateStudents } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: "At least one student ID is required" },
        { status: 400 }
      );
    }

    if (!graduationYear) {
      return NextResponse.json(
        { error: "Graduation year is required" },
        { status: 400 }
      );
    }

    // Fetch students to graduate
    const studentsToGraduate = await db
      .select()
      .from(students)
      .where(inArray(students.id, studentIds));

    if (studentsToGraduate.length === 0) {
      return NextResponse.json(
        { error: "No valid students found" },
        { status: 404 }
      );
    }

    // Create alumni records from students
    const alumniRecords = studentsToGraduate.map((student) => ({
      studentId: student.id,
      nisn: student.nisn,
      nis: student.nis,
      fullName: student.fullName,
      gender: student.gender as "L" | "P" | undefined,
      birthPlace: student.birthPlace,
      birthDate: student.birthDate,
      graduationYear,
      graduationDate: graduationDate ? new Date(graduationDate) : new Date(),
      finalClass: student.className,
      photo: student.photo,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
    }));

    // Insert alumni records
    const insertedAlumni = await db
      .insert(alumni)
      .values(alumniRecords)
      .returning();

    // Optionally deactivate students
    if (deactivateStudents) {
      await db
        .update(students)
        .set({ isActive: false })
        .where(inArray(students.id, studentIds));
    }

    return NextResponse.json({
      message: `Successfully graduated ${insertedAlumni.length} students`,
      alumni: insertedAlumni,
      deactivated: deactivateStudents ? studentIds.length : 0,
    });
  } catch (error) {
    console.error("Error graduating students:", error);
    return NextResponse.json(
      { error: "Failed to graduate students" },
      { status: 500 }
    );
  }
}
