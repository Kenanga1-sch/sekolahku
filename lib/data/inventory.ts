
import { db } from "@/db";
import { inventoryAssets, inventoryRooms, inventoryAudit, inventoryItems, inventoryTransactions } from "@/db/schema/inventory";
import { users } from "@/db/schema/users";
import { eq, sql, desc, or, count, sum } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export const getCachedInventoryStats = unstable_cache(
  async () => {
    try {
      const [stats] = await db.select({
        totalAssets: count(inventoryAssets.id),
        totalValue: sql<number>`sum(${inventoryAssets.price} * ${inventoryAssets.quantity})`,
        totalItems: sum(inventoryAssets.quantity),
        itemsGood: sum(inventoryAssets.conditionGood),
        itemsDamaged: sql<number>`sum(${inventoryAssets.conditionLightDamaged} + ${inventoryAssets.conditionHeavyDamaged})`,
        itemsLost: sum(inventoryAssets.conditionLost),
      }).from(inventoryAssets);

      return {
        totalAssets: Number(stats.totalAssets) || 0,
        totalValue: Number(stats.totalValue) || 0,
        totalItems: Number(stats.totalItems) || 0,
        itemsGood: Number(stats.itemsGood) || 0,
        itemsDamaged: Number(stats.itemsDamaged) || 0,
        itemsLost: Number(stats.itemsLost) || 0,
      };
    } catch (error) {
      console.error("Error fetching inventory stats:", error);
      return { totalAssets: 0, totalValue: 0, totalItems: 0, itemsGood: 0, itemsDamaged: 0, itemsLost: 0 };
    }
  },
  ["inventory-stats"],
  { revalidate: 300 } // 5 minutes cache
);

export const getCachedConsumableStats = unstable_cache(
    async () => {
        try {
            const [stats] = await db.select({
                totalItems: count(inventoryItems.id),
                totalValue: sql<number>`sum(${inventoryItems.price} * ${inventoryItems.currentStock})`,
                lowStockCount: sql<number>`count(CASE WHEN current_stock <= min_stock THEN 1 END)`,
            }).from(inventoryItems);

            const recentTransactions = await db.query.inventoryTransactions.findMany({
                with: {
                    item: true,
                    user: true,
                },
                orderBy: [desc(inventoryTransactions.date)],
                limit: 5,
            });

            return {
                totalItems: Number(stats.totalItems) || 0,
                totalValue: Number(stats.totalValue) || 0,
                lowStockCount: Number(stats.lowStockCount) || 0,
                recentTransactions: recentTransactions.map(t => ({
                    id: t.id,
                    type: t.type,
                    quantity: t.quantity,
                    date: t.date?.toISOString(),
                    item: t.item,
                    user: { name: t.user?.fullName || t.user?.name || "Admin" }
                })),
            };
        } catch (error) {
            console.error("Error fetching consumable stats:", error);
            return { totalItems: 0, totalValue: 0, lowStockCount: 0, recentTransactions: [] };
        }
    },
    ["consumable-stats"],
    { revalidate: 300 }
);

export async function getCategoryDistribution() {
    const stats = await db.select({
        name: inventoryAssets.category,
        value: count(inventoryAssets.id),
    })
    .from(inventoryAssets)
    .groupBy(inventoryAssets.category);

    const colors: Record<string, string> = {
        "Elektronik": "#3b82f6",
        "Furniture": "#10b981",
        "Alat Tulis": "#f59e0b",
        "Buku": "#8b5cf6",
        "Kendaraan": "#ef4444",
        "OTHER": "#6b7280",
    };

    return stats.map(s => ({
        name: s.name,
        value: Number(s.value),
        color: colors[s.name] || colors.OTHER
    }));
}
