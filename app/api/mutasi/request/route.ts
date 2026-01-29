import { NextResponse } from "next/server";
import { db, mutasiRequests } from "@/db"; // Adjust import path if needed
import { broadcastNotification } from "@/lib/notifications";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";

const requestSchema = z.object({
  studentName: z.string().min(3),
  nisn: z.string().min(10),
  gender: z.enum(["L", "P"]),
  originSchool: z.string().min(3),
  originSchoolAddress: z.string().min(5),
  targetGrade: z.coerce.number().min(1).max(6),
  parentName: z.string().min(3),
  whatsappNumber: z.string().min(10),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // Format WhatsApp number (replace 08 with 62)
    let whatsappNumber = validatedData.whatsappNumber;
    if (whatsappNumber.startsWith("0")) {
      whatsappNumber = "62" + whatsappNumber.slice(1);
    }

    // Generate Registration Number: MUT-{TIMESTAMP}-{RANDOM}
    // Actually using a simpler format like MUT-{YYYYMMDD}-{RANDOM} might be better
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    const registrationNumber = `MUT-${date}-${random}`;

    const newRequest = await db.insert(mutasiRequests).values({
      registrationNumber,
      studentName: validatedData.studentName,
      nisn: validatedData.nisn,
      gender: validatedData.gender,
      originSchool: validatedData.originSchool,
      originSchoolAddress: validatedData.originSchoolAddress,
      targetGrade: validatedData.targetGrade,
      parentName: validatedData.parentName,
      whatsappNumber,
      statusApproval: "pending",
      statusDelivery: "unsent",
    }).returning();

    // Notify admins
    await broadcastNotification(["superadmin", "admin"], {
      title: "Mutasi Masuk Baru",
      message: `Permohonan baru dari ${validatedData.studentName} (Asal: ${validatedData.originSchool})`,
      type: "info",
      category: "student",
      targetUrl: `/admin/mutasi`,
      metadata: { requestId: newRequest[0].id }
    });

    return NextResponse.json({
      success: true,
      data: newRequest[0],
      message: "Permohonan berhasil dikirim. Kami akan segera menghubungi Anda.",
    });

  } catch (error) {
    console.error("Error creating mutasi request:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "Invalid data", errors: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
