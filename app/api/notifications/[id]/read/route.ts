import { auth } from "@/auth";
import { db, adminNotifications } from "@/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  try {
    const [updated] = await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(adminNotifications.id, id),
          eq(adminNotifications.userId, session.user.id) // Security check: only own notifications
        )
      )
      .returning();

    if (!updated) {
        return new NextResponse("Notification not found", { status: 404 });
    }

    return NextResponse.json({ success: true, warning: false });
  } catch (error) {
    console.error("[NOTIFICATIONS_MARK_READ]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
