/**
 * inventory — Client-side data fetcher for Inventory Stats
 */

import { goGet } from "@/lib/api-client";

function unwrapStats(res: any) {
  return res?.data ?? res ?? {
    totalAssets: 0,
    totalValue: 0,
    totalItems: 0,
    itemsGood: 0,
    itemsDamaged: 0,
    itemsLost: 0,
  };
}

export async function getCategoryDistribution() {
  // Can be summarized from stats or a specific endpoint
  return unwrapStats(await goGet("/api/inventory/stats"));
}

export async function getCachedInventoryStats() {
  return unwrapStats(await goGet("/api/inventory/stats"));
}

export async function getCachedConsumableStats() {
  const [itemsResponse, transactionsResponse] = await Promise.all([
    goGet("/api/inventory/items?limit=1000"),
    goGet("/api/inventory/transactions?limit=5").catch(() => ({ items: [] })),
  ]);
  const items = itemsResponse?.items ?? itemsResponse?.data ?? [];
  const recentTransactions = transactionsResponse?.items ?? transactionsResponse?.data ?? [];

  return {
    totalItems: items.length,
    totalValue: items.reduce(
      (sum: number, item: any) => sum + ((item.currentStock ?? 0) * (item.price ?? 0)),
      0
    ),
    lowStockCount: items.filter((item: any) => (item.currentStock ?? 0) <= (item.minStock ?? 0)).length,
    recentTransactions,
  };
}
