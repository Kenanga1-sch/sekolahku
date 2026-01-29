import { NextResponse } from "next/server";
import { db, staffProfiles } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  degree: z.string().optional(),
  position: z.string().min(1).optional(),
  category: z.enum(["kepsek", "guru", "staff", "support"]).optional(),
  photoUrl: z.string().optional(),
  nip: z.string().optional(),
  quote: z.string().optional(),
  displayOrder: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Data tidak valid", errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await db
      .update(staffProfiles)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(eq(staffProfiles.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ message: "Data tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated[0] });

  } catch (error) {
    console.error("Update staff error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    
    // Hard delete
    await db.delete(staffProfiles).where(eq(staffProfiles.id, id));

    return NextResponse.json({ success: true, message: "Data dihapus" });

  } catch (error) {
    console.error("Delete staff error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
