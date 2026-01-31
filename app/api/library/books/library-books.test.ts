import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { createMockRequest } from '@/tests/api-test-utils';
import { libraryCatalog, libraryAssets } from '@/db/schema/library';

vi.mock('@/lib/auth-checks', () => ({
    requireAuth: vi.fn(() => ({ authorized: true, user: { id: '1' } })),
    requireRole: vi.fn(() => ({ authorized: true, user: { id: '1' } })),
}));

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('@/tests/test-utils');
    const { db } = createTestDb();
    return { db, ...schema };
});

import { db } from '@/db';

describe('API /api/library/books', () => {
    beforeEach(async () => {
        await db.delete(libraryAssets);
        await db.delete(libraryCatalog);
    });

    it('should return list of books', async () => {
        const [cat] = await db.insert(libraryCatalog).values({ title: 'Book 1' } as any).returning();
        await db.insert(libraryAssets).values({ id: 'BK-1', catalogId: cat.id } as any);

        const req = createMockRequest({ url: 'http://localhost/api/library/books?search=Book' });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.items.length).toBe(1);
        expect(data.items[0].catalog.title).toBe('Book 1');
    });

    it('should create a new book item', async () => {
        const body = {
            title: 'New Book',
            isbn: '123-456',
            qrCode: 'BK-NEW'
        };

        const req = createMockRequest({ method: 'POST', body });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.id).toBe('BK-NEW');

        const [asset] = await db.select().from(libraryAssets).where(eq(libraryAssets.id, 'BK-NEW'));
        expect(asset).toBeDefined();
    });
});
import { eq } from 'drizzle-orm';
