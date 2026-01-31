import { getCachedConsumableStats } from "@/lib/data/inventory";
import { requireRole } from "@/lib/auth-checks";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const auth = await requireRole(["admin", "staff"]);
    if (!auth.authorized) return auth.response;

    const stats = await getCachedConsumableStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[INVENTORY_STATS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
