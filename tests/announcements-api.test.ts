import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/announcements/route';
import { createMockRequest } from './api-test-utils';

vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('./test-utils');
    const { db } = createTestDb();
    return {
        db,
        ...schema,
        announcements: schema.announcements,
    };
});

import { db, announcements } from '@/db';
import { auth } from '@/auth';

describe('Announcements API', () => {
    beforeEach(async () => {
        await db.delete(announcements);
    });

    it('should create and list announcements', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);

        const payload = {
            title: 'Test Announcement',
            content: 'Hello World',
            is_published: true
        };

        const postReq = createMockRequest({
            method: 'POST',
            body: payload
        });
        const postRes = await POST(postReq);
        expect(postRes.status).toBe(200);

        const getReq = createMockRequest({
            method: 'GET',
            url: 'http://localhost/api/announcements'
        });
        const getRes = await GET(getReq);
        const data = await getRes.json();
        expect(data.length).toBe(1);
        expect(data[0].title).toBe('Test Announcement');
    });

    it('should filter announcements by search query', async () => {
        await db.insert(announcements).values([
            { id: 'a1', title: 'Target', slug: 'target', isPublished: true },
            { id: 'a2', title: 'Other', slug: 'other', isPublished: true }
        ] as any);

        const getReq = createMockRequest({
            method: 'GET',
            url: 'http://localhost/api/announcements?search=Target'
        });
        const getRes = await GET(getReq);
        const data = await getRes.json();
        expect(data.length).toBe(1);
        expect(data[0].title).toBe('Target');
    });
});
