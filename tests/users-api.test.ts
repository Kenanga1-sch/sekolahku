import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/users/route';
import { GET as getById, PATCH, DELETE } from '@/app/api/users/[id]/route';
import { createMockRequest } from './api-test-utils';
import { eq } from 'drizzle-orm';

vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('./test-utils');
    const { db } = createTestDb();
    return {
        db,
        ...schema,
        users: schema.users,
    };
});

import { db, users } from '@/db';
import { auth } from '@/auth';

describe('Users API', () => {
    beforeEach(async () => {
        await db.delete(users);
    });

    it('should create and list users', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any);

        const payload = {
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User',
            role: 'staff'
        };

        const postReq = createMockRequest({
            method: 'POST',
            body: payload
        });
        const postRes = await POST(postReq);
        expect(postRes.status).toBe(200);

        const getReq = createMockRequest({
            method: 'GET',
            url: 'http://localhost/api/users'
        });
        const getRes = await GET(getReq);
        const data = await getRes.json();

        expect(data.items.length).toBe(1);
        expect(data.items[0].email).toBe('test@example.com');
    });

    it('should reject unauthorized access to user list', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { role: 'user' } } as any);

        const getReq = createMockRequest({
            method: 'GET',
            url: 'http://localhost/api/users'
        });
        const getRes = await GET(getReq);
        expect(getRes.status).toBe(401);
    });

    it('should get user by id', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any);
        const [user] = await db.insert(users).values({ id: 'u1', email: 'u1@test.com', name: 'U1' } as any).returning();

        const res = await getById({} as Request, { params: Promise.resolve({ id: user.id }) });
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.email).toBe('u1@test.com');
    });

    it('should update user', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any);
        const [user] = await db.insert(users).values({ id: 'u2', email: 'u2@test.com', name: 'U2' } as any).returning();

        const req = createMockRequest({
            method: 'PATCH',
            body: { name: 'Updated Name' }
        });
        const res = await PATCH(req, { params: Promise.resolve({ id: user.id }) });
        expect(res.status).toBe(200);

        const updated = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        expect(updated?.name).toBe('Updated Name');
    });

    it('should delete user and prevent self-deletion', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-id', role: 'admin' } } as any);
        const [user] = await db.insert(users).values({ id: 'u3', email: 'u3@test.com', name: 'U3' } as any).returning();

        // Try self delete
        const reqSelf = createMockRequest({ method: 'DELETE' });
        const resSelf = await DELETE(reqSelf, { params: Promise.resolve({ id: 'admin-id' }) });
        expect(resSelf.status).toBe(400);

        // Delete other
        const reqOther = createMockRequest({ method: 'DELETE' });
        const resOther = await DELETE(reqOther, { params: Promise.resolve({ id: user.id }) });
        expect(resOther.status).toBe(200);

        const deleted = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        expect(deleted).toBeUndefined();
    });

    it('should prevent admin from deleting superadmin', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-id', role: 'admin' } } as any);
        const [sa] = await db.insert(users).values({ id: 'sa-id', email: 'sa@test.com', role: 'superadmin' } as any).returning();

        const req = createMockRequest({ method: 'DELETE' });
        const res = await DELETE(req, { params: Promise.resolve({ id: sa.id }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toBe('Admin cannot delete Super Admin');
    });
});
