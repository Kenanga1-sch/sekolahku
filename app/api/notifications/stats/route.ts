import { auth } from "@/auth";
import { db, adminNotifications } from "@/db";
import { and, eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ unreadCount: 0 }, { status: 401 });
  }

  try {
    const [result] = await db
      .select({ count: count() })
      .from(adminNotifications)
      .where(
        and(
          eq(adminNotifications.userId, session.user.id),
          eq(adminNotifications.isRead, false)
        )
      );

    return NextResponse.json({ unreadCount: result?.count || 0 });
  } catch (error) {
    console.error("[NOTIFICATIONS_STATS_GET]", error);
    return NextResponse.json({ unreadCount: 0 }, { status: 500 });
  }
}
