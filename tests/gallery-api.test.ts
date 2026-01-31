import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/gallery/route';
import { createMockRequest } from './api-test-utils';

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('./test-utils');
    const { db } = createTestDb();
    return {
        db,
        ...schema,
        galleries: schema.galleries,
    };
});

import { db, galleries } from '@/db';

describe('Gallery API', () => {
    beforeEach(async () => {
        await db.delete(galleries);
    });

    it('should list gallery items', async () => {
        await db.insert(galleries).values([
            { id: 'g1', title: 'Activity 1', category: 'kegiatan', imageUrl: '/img1.jpg' },
            { id: 'g2', title: 'Achievement 1', category: 'prestasi', imageUrl: '/img2.jpg' }
        ] as any);

        const req = createMockRequest({
            method: 'GET',
            url: 'http://localhost/api/gallery'
        });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.length).toBe(2);
    });

    it('should filter gallery by category', async () => {
        await db.insert(galleries).values([
            { id: 'g1', title: 'Activity 1', category: 'kegiatan', imageUrl: '/img1.jpg' },
            { id: 'g2', title: 'Achievement 1', category: 'prestasi', imageUrl: '/img2.jpg' }
        ] as any);

        const req = createMockRequest({
            method: 'GET',
            url: 'http://localhost/api/gallery?category=prestasi'
        });
        const res = await GET(req);
        const data = await res.json();

        expect(data.data.length).toBe(1);
        expect(data.data[0].category).toBe('prestasi');
    });
});
