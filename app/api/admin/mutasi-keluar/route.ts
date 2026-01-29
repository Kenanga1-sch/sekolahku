import { NextResponse } from "next/server";
import { db, mutasiOutRequests, students } from "@/db";
import { auth } from "@/auth";
import { desc, eq } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await db
      .select({
        id: mutasiOutRequests.id,
        nisn: students.nisn,
        studentName: students.fullName,
        className: students.className,
        destinationSchool: mutasiOutRequests.destinationSchool,
        reason: mutasiOutRequests.reason,
        reasonDetail: mutasiOutRequests.reasonDetail,
        status: mutasiOutRequests.status,
        createdAt: mutasiOutRequests.createdAt,
        downloadedAt: mutasiOutRequests.downloadedAt,
      })
      .from(mutasiOutRequests)
      .leftJoin(students, eq(mutasiOutRequests.studentId, students.id))
      .orderBy(desc(mutasiOutRequests.createdAt));
    
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error("Error fetching mutasi requests:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
