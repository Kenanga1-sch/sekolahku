import { NextResponse } from "next/server";
import { db, mutasiOutRequests, students } from "@/db";
import { broadcastNotification } from "@/lib/notifications";
import { eq, and, gt, sql } from "drizzle-orm";
import { z } from "zod";

const requestSchema = z.object({
  studentId: z.string().min(1, "Data siswa tidak valid"),
  destinationSchool: z.string().min(3, "Nama sekolah tujuan minimal 3 karakter"),
  reason: z.enum(["domisili", "tugas_orangtua", "lainnya"]),
  reasonDetail: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Data tidak valid", errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { studentId, destinationSchool, reason, reasonDetail } = validation.data;

    // Verify student exists and is active
    const student = await db.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.isActive, true))
    });

    if (!student) {
      return NextResponse.json({ message: "Siswa tidak ditemukan" }, { status: 404 });
    }

    // Rate Limiting: Check requests from this student in the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentRequests = await db
      .select({ count: sql<number>`count(*)` })
      .from(mutasiOutRequests)
      .where(
        and(
          eq(mutasiOutRequests.studentId, studentId),
          gt(mutasiOutRequests.createdAt, oneDayAgo)
        )
      );

    const requestCount = recentRequests[0]?.count || 0;

    if (requestCount >= 3) {
      return NextResponse.json(
        { message: "Batas pembuatan surat tercapai (maks 3x sehari). Silakan coba lagi besok." },
        { status: 429 }
      );
    }

    // Save request
    await db.insert(mutasiOutRequests).values({
      studentId,
      destinationSchool,
      reason,
      reasonDetail,
      status: "draft",
      downloadedAt: new Date(), // Asuming this is triggered when they click download
    });

    // Notify admins
    await broadcastNotification(["superadmin", "admin"], {
      title: "Mutasi Keluar Baru",
      message: `Permohonan surat pindah untuk siswa ${student.fullName} ke ${destinationSchool}`,
      type: "info",
      category: "student",
      targetUrl: `/admin/mutasi-keluar/history`, // Or correct admin url
    });

    return NextResponse.json({ success: true, message: "Permohonan berhasil dibuat" });

  } catch (error) {
    console.error("Request error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
