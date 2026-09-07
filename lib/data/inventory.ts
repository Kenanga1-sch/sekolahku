/**
 * inventory — pintu data dashboard inventaris.
 *
 * Sebelumnya file ini menduplikasi getInventoryStats / getCategoryDistribution
 * dari lib/inventory.ts dengan kontrak berbeda (satu menelan error, satu
 * melempar). Kini hanya pembungkus ATK yang spesifik dashboard.
 */

import { goGet } from "@/lib/api-client";
import { unwrapItems } from "@/lib/inventory";

export { getInventoryStats as getCachedInventoryStats } from "@/lib/inventory";

export interface ConsumableStats {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    recentTransactions: unknown[];
}

export async function getCachedConsumableStats(): Promise<ConsumableStats> {
    const [itemsResponse, transactionsResponse] = await Promise.all([
        goGet("/api/inventory/items?limit=200"),
        goGet("/api/inventory/transactions?limit=5").catch(() => ({ items: [] })),
    ]);

    const items = unwrapItems<{ currentStock: number; minStock: number; price: number }>(itemsResponse);
    const recentTransactions = unwrapItems(transactionsResponse);

    return {
        totalItems: items.length,
        totalValue: items.reduce(
            (sum, item) => sum + (item.currentStock ?? 0) * (item.price ?? 0),
            0
        ),
        lowStockCount: items.filter(item => (item.currentStock ?? 0) <= (item.minStock ?? 0)).length,
        recentTransactions,
    };
}
