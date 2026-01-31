import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { createMockRequest } from '@/tests/api-test-utils';
import { inventoryAssets, inventoryRooms } from '@/db/schema/inventory';

vi.mock('@/auth', () => ({
    auth: vi.fn(() => ({ user: { id: 'admin-1', role: 'admin' } })),
}));

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('@/tests/test-utils');
    const { db } = createTestDb();
    return { db, ...schema };
});

import { db } from '@/db';

describe('API /api/inventory/assets', () => {
    beforeEach(async () => {
        await db.delete(inventoryAssets);
        await db.delete(inventoryRooms);
    });

    it('should return inventory assets', async () => {
        await db.insert(inventoryAssets).values({
            id: 'a1',
            name: 'Chair',
            roomId: 'r1',
            category: 'Furniture'
        } as any);

        const req = createMockRequest({ url: 'http://localhost/api/inventory/assets?q=Chair' });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.items.length).toBe(1);
    });

    it('should create an asset', async () => {
        const body = {
            name: 'Table',
            roomId: 'r1',
            quantity: 2
        };

        const req = createMockRequest({ method: 'POST', body });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.name).toBe('Table');
    });
});
