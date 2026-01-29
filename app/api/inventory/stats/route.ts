import { db } from "@/db";
import { inventoryItems, inventoryTransactions } from "@/db/schema/inventory";
import { requireRole } from "@/lib/auth-checks";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const auth = await requireRole(["admin", "staff"]);
    if (!auth.authorized) return auth.response;

    // Parallel queries for stats
    const [totalItemsResult, lowStockResult, totalValueResult, lastTransactions] = await Promise.all([
      // Total Items
      db.select({ count: sql<number>`count(*)` }).from(inventoryItems),
      
      // Low Stock Items (current <= min)
      db.select({ count: sql<number>`count(*)` })
        .from(inventoryItems)
        .where(sql`${inventoryItems.currentStock} <= ${inventoryItems.minStock}`),

      // Total Value (sum(price * currentStock))
      db.select({ value: sql<number>`sum(${inventoryItems.price} * ${inventoryItems.currentStock})` })
        .from(inventoryItems),

      // Last 5 Transactions
      db.query.inventoryTransactions.findMany({
        limit: 5,
        orderBy: (usage, { desc }) => [desc(usage.date)],
        with: {
           item: true,
           user: true
        }
      })
    ]);

    const stats = {
      totalItems: totalItemsResult[0]?.count || 0,
      lowStockCount: lowStockResult[0]?.count || 0,
      totalValue: totalValueResult[0]?.value || 0,
      recentTransactions: lastTransactions,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[INVENTORY_STATS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
