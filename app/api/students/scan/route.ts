import { NextRequest, NextResponse } from "next/server";
import { db, students, libraryMembers, tabunganSiswa, tabunganKelas } from "@/db";
import { eq } from "drizzle-orm";

// GET /api/students/scan?qrCode=xxx
// Universal student QR code scan API
// Returns: student data + linked library/tabungan info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const qrCode = searchParams.get("qrCode");

    if (!qrCode) {
      return NextResponse.json(
        { error: "QR code parameter is required" },
        { status: 400 }
      );
    }

    // 1. Find student by QR code
    const student = await db.query.students.findFirst({
      where: eq(students.qrCode, qrCode),
    });

    if (!student) {
      return NextResponse.json(
        { error: "Siswa tidak ditemukan", found: false },
        { status: 404 }
      );
    }

    // 2. Find linked library member
    const libraryMember = await db.query.libraryMembers.findFirst({
      where: eq(libraryMembers.studentId, student.id),
    });

    // 3. Find linked tabungan siswa with kelas info
    const tabunganSiswaData = await db.query.tabunganSiswa.findFirst({
      where: eq(tabunganSiswa.studentId, student.id),
      with: {
        kelas: true,
      },
    });

    return NextResponse.json({
      found: true,
      student: {
        id: student.id,
        nisn: student.nisn,
        nis: student.nis,
        fullName: student.fullName,
        className: student.className,
        photo: student.photo,
        qrCode: student.qrCode,
        gender: student.gender,
        isActive: student.isActive,
      },
      library: libraryMember
        ? {
            id: libraryMember.id,
            memberId: libraryMember.id,
            maxBorrowLimit: libraryMember.maxBorrowLimit,
            isActive: libraryMember.isActive,
          }
        : null,
      tabungan: tabunganSiswaData
        ? {
            id: tabunganSiswaData.id,
            saldo: tabunganSiswaData.saldoTerakhir,
            kelas: tabunganSiswaData.kelas?.nama,
            isActive: tabunganSiswaData.isActive,
          }
        : null,
    });
  } catch (error) {
    console.error("Error scanning student QR:", error);
    return NextResponse.json(
      { error: "Failed to scan student QR" },
      { status: 500 }
    );
  }
}
