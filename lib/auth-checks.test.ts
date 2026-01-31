import { describe, it, expect, vi } from 'vitest';
import { requireAuth, requireRole, requireUserOrRole } from './auth-checks';
import { NextResponse } from 'next/server';

vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

import { auth } from '@/auth';

describe('Auth Checks', () => {
    it('requireAuth should return unauthorized if no session', async () => {
        vi.mocked(auth).mockResolvedValueOnce(null);
        const result = await requireAuth();
        expect(result.authorized).toBe(false);
        if (!result.authorized) {
            expect(result.response.status).toBe(401);
        }
    });

    it('requireAuth should return authorized if session exists', async () => {
        vi.mocked(auth).mockResolvedValueOnce({ user: { id: '1' } } as any);
        const result = await requireAuth();
        expect(result.authorized).toBe(true);
    });

    it('requireRole should return forbidden if role mismatch', async () => {
        vi.mocked(auth).mockResolvedValueOnce({ user: { id: '1', role: 'user' } } as any);
        const result = await requireRole(['admin']);
        expect(result.authorized).toBe(false);
        if (!result.authorized) {
            expect(result.response.status).toBe(403);
        }
    });

    it('requireUserOrRole should allow if ID matches', async () => {
        vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'target', role: 'user' } } as any);
        const result = await requireUserOrRole('target', ['admin']);
        expect(result.authorized).toBe(true);
    });

    it('requireUserOrRole should allow if role matches even if ID mismatch', async () => {
        vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'other', role: 'admin' } } as any);
        const result = await requireUserOrRole('target', ['admin']);
        expect(result.authorized).toBe(true);
    });
});
