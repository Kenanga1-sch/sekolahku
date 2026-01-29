import { NextResponse } from "next/server";
import { db, mutasiRequests } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  statusApproval: z.enum(["pending", "verified", "principal_approved", "rejected"]).optional(),
  statusDelivery: z.enum(["unsent", "sent"]).optional(),
  targetClassId: z.string().optional().nullable(),
  targetGrade: z.number().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;

  try {
    const body = await request.json();
    const validatedData = updateSchema.parse(body);

    const updated = await db
      .update(mutasiRequests)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(mutasiRequests.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error("Error updating mutasi request:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
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
  
  const { id } = await params;

  try {
    await db.delete(mutasiRequests).where(eq(mutasiRequests.id, id));
    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    console.error("Error deleting mutasi request:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
