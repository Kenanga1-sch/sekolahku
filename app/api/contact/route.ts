
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contactMessages } from "@/db/schema/misc";
import { broadcastNotification } from "@/lib/notifications";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter"),
  email: z.string().email("Format email tidak valid"),
  subject: z.string().min(5, "Subjek minimal 5 karakter"),
  message: z.string().min(20, "Pesan minimal 20 karakter"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = contactSchema.parse(body);

    await db.insert(contactMessages).values({
      name: validatedData.name,
      email: validatedData.email,
      subject: validatedData.subject,
      message: validatedData.message,
    });

    // Notify admins
    await broadcastNotification(["superadmin", "admin"], {
      title: "Pesan Baru dari Website",
      message: `${validatedData.name}: ${validatedData.subject}`,
      type: "info",
      category: "system",
      targetUrl: `/admin/pesan`, // Adjust if there is a messages page
    });

    return NextResponse.json(
      { message: "Pesan berhasil dikirim" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validasi gagal", errors: error.issues },
        { status: 400 }
      );
    }

    console.error("Contact form error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
