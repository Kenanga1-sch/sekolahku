import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inventoryAssets, inventoryRooms, inventoryItems, inventoryTransactions } from '../../db/schema/inventory';
import { users } from '../../db/schema/users';
import {
    getCachedInventoryStats,
    getCachedConsumableStats,
    getCategoryDistribution
} from './inventory';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache: (fn: any) => fn
}));

vi.mock('@/db', async () => {
    const { createTestDb } = await import('../../tests/test-utils');
    const { db } = createTestDb();
    return { db };
});

import { db } from '@/db';

async function cleanup() {
    await db.delete(inventoryTransactions);
    await db.delete(inventoryItems);
    await db.delete(inventoryAssets);
    await db.delete(inventoryRooms);
    await db.delete(users);
}

describe('Inventory Data Logic', () => {
    beforeEach(async () => {
        await cleanup();
    });

    it('should calculate inventory stats', async () => {
        await db.insert(inventoryAssets).values({
            id: 'a1',
            name: 'Laptop',
            category: 'Elektronik',
            price: 10000000,
            quantity: 5,
            conditionGood: 4,
            conditionLightDamaged: 1,
            conditionHeavyDamaged: 0,
            conditionLost: 0,
        } as any);

        const stats = await getCachedInventoryStats();
        expect(stats.totalAssets).toBe(1);
        expect(stats.totalValue).toBe(50000000);
        expect(stats.itemsGood).toBe(4);
        expect(stats.itemsDamaged).toBe(1);
    });

    it('should calculate consumable stats', async () => {
        await db.insert(inventoryItems).values({
            id: 'i1',
            name: 'Kertas A4',
            price: 50000,
            currentStock: 10,
            minStock: 5,
        } as any);

        const stats = await getCachedConsumableStats();
        expect(stats.totalItems).toBe(1);
        expect(stats.totalValue).toBe(500000);
    });

    it('should get category distribution', async () => {
        await db.insert(inventoryAssets).values([
            { id: 'a1', name: 'L1', category: 'Elektronik' },
            { id: 'a2', name: 'L2', category: 'Elektronik' },
            { id: 'a3', name: 'F1', category: 'Furniture' },
        ] as any);

        const dist = await getCategoryDistribution();
        expect(dist.find(d => d.name === 'Elektronik')?.value).toBe(2);
        expect(dist.find(d => d.name === 'Furniture')?.value).toBe(1);
    });
});
