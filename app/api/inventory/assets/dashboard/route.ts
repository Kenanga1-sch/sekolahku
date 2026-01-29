import { getInventoryStats, getCategoryDistribution, getConditionBreakdown, getTopRoomsByValue, getRecentAudit } from "@/lib/inventory";
import { requireRole } from "@/lib/auth-checks";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(["admin", "staff"]);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    switch (type) {
      case "category-distribution":
        const categories = await getCategoryDistribution();
        return NextResponse.json(categories);
      
      case "condition-breakdown":
        const conditions = await getConditionBreakdown();
        return NextResponse.json(conditions);
      
      case "top-rooms":
        const rooms = await getTopRoomsByValue(5);
        return NextResponse.json(rooms);
      
      case "recent-audit":
        const audit = await getRecentAudit(10);
        return NextResponse.json(audit);
      
      default:
        // Default to stats
        const stats = await getInventoryStats();
        return NextResponse.json(stats);
    }
  } catch (error) {
    console.error("Failed to fetch inventory data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
