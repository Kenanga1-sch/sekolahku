import { NextResponse } from "next/server";
import { db, mutasiRequests } from "@/db";
import { auth } from "@/auth";
import { desc } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await db
      .select()
      .from(mutasiRequests)
      .orderBy(desc(mutasiRequests.createdAt));
    
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error("Error fetching mutasi requests:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
