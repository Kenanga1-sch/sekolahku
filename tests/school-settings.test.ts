import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/school-settings/route';
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
        schoolSettings: schema.schoolSettings,
    };
});

import { db, schoolSettings } from '@/db';
import { auth } from '@/auth';

describe('School Settings API', () => {
    beforeEach(async () => {
        await db.delete(schoolSettings);
    });

    it('should return defaults if no settings found', async () => {
        const res = await GET();
        const data = await res.json();
        expect(data.school_name).toBe("UPTD SDN 1 Kenanga");
        expect(data.id).toBeNull();
    });

    it('should save and retrieve school settings', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any);

        const payload = {
            school_name: "Test School",
            school_npsn: "12345",
            spmb_is_open: true,
        };

        const postReq = createMockRequest({
            method: 'POST',
            body: payload
        });
        const postRes = await POST(postReq);
        const postData = await postRes.json();
        expect(postRes.status).toBe(200);
        expect(postData.success).toBe(true);

        const getRes = await GET();
        const getData = await getRes.json();
        expect(getData.school_name).toBe("Test School");
        expect(getData.id).toBe(postData.id);
    });

    it('should update existing settings', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any);

        // First insert
        const [initial] = await db.insert(schoolSettings).values({
            schoolName: "Initial Name",
        }).returning();

        const payload = {
            id: initial.id,
            school_name: "Updated Name",
        };

        const postReq = createMockRequest({
            method: 'POST',
            body: payload
        });
        const postRes = await POST(postReq);
        expect(postRes.status).toBe(200);

        const getRes = await GET();
        const getData = await getRes.json();
        expect(getData.school_name).toBe("Updated Name");
    });

    it('should reject unauthorized users', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { role: 'user' } } as any);

        const postReq = createMockRequest({
            method: 'POST',
            body: { school_name: "Hacker School" }
        });
        const postRes = await POST(postReq);
        expect(postRes.status).toBe(401);
    });
});
