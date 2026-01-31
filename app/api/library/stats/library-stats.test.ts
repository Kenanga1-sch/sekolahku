import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createMockRequest } from '@/tests/api-test-utils';
import { libraryAssets } from '@/db/schema/library';

vi.mock('@/lib/auth-checks', () => ({
    requireRole: vi.fn(() => ({ authorized: true, user: { id: '1' } })),
}));

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('@/tests/test-utils');
    const { db } = createTestDb();
    return { db, ...schema };
});

import { db } from '@/db';

describe('API /api/library/stats', () => {
    beforeEach(async () => {
        await db.delete(libraryAssets);
    });

    it('should return library stats', async () => {
        await db.insert(libraryAssets).values({
            id: 'BK-1',
            catalogId: 'cat-1',
            status: 'AVAILABLE'
        } as any);

        const req = createMockRequest({ method: 'GET' });
        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.totalBooks).toBe(1);
        expect(data.availableBooks).toBe(1);
    });
});
