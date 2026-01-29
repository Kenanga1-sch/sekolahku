import { auth } from "@/auth";
import { db, adminNotifications } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const notifications = await db
      .select()
      .from(adminNotifications)
      .where(eq(adminNotifications.userId, session.user.id))
      .orderBy(desc(adminNotifications.createdAt)) // Latest first
      .limit(limit);

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("[NOTIFICATIONS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
