import { auth } from "@/auth";
import { db, adminNotifications } from "@/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(eq(adminNotifications.userId, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NOTIFICATIONS_READ_ALL]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
