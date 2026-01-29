import { getLibraryStats } from "@/lib/library";
import { requireRole } from "@/lib/auth-checks";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = await requireRole(["admin", "librarian"]);
    if (!auth.authorized) return auth.response;

    // Use the existing library helper function
    const stats = await getLibraryStats();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch library stats:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
