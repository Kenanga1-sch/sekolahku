import { NextResponse } from "next/server";
import { db, mutasiOutRequests } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";

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
    const { status } = body;

    if (!status) {
        return NextResponse.json({ message: "Status required" }, { status: 400 });
    }

    await db
        .update(mutasiOutRequests)
        .set({ 
            status,
            updatedAt: new Date(),
            ...(status === "processed" ? { processedAt: new Date() } : {}),
            ...(status === "completed" ? { completedAt: new Date() } : {}),
        })
        .where(eq(mutasiOutRequests.id, id));

    return NextResponse.json({ success: true, message: "Status updated" });

  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
