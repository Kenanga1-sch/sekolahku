import { requireRole } from "@/lib/auth-checks";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { inventoryAssets } from "@/db/schema/inventory";
import { sql, eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(["admin", "staff"]);
    if (!auth.authorized) return auth.response;

    // Aggregate stats directly from DB
    const [stats] = await db
      .select({
        totalAssets: sql<number>`count(*)`,
        totalValue: sql<number>`sum(${inventoryAssets.price} * ${inventoryAssets.quantity})`,
        totalItems: sql<number>`sum(${inventoryAssets.quantity})`,
        itemsGood: sql<number>`sum(${inventoryAssets.conditionGood})`,
        itemsDamaged: sql<number>`sum(${inventoryAssets.conditionLightDamaged} + ${inventoryAssets.conditionHeavyDamaged})`,
        itemsLost: sql<number>`sum(${inventoryAssets.conditionLost})`,
      })
      .from(inventoryAssets)
      .where(eq(inventoryAssets.status, "ACTIVE"));

    // Ensure no nulls
    const safeStats = {
      totalAssets: stats?.totalAssets || 0,
      totalValue: stats?.totalValue || 0,
      totalItems: stats?.totalItems || 0,
      itemsGood: stats?.itemsGood || 0,
      itemsDamaged: stats?.itemsDamaged || 0,
      itemsLost: stats?.itemsLost || 0,
    };

    return NextResponse.json(safeStats);
  } catch (error) {
    console.error("Failed to fetch inventory reports:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
