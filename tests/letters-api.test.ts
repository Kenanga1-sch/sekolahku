import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/letters/numbering/route';
import { createMockRequest } from './api-test-utils';

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('./test-utils');
    const { db } = createTestDb();
    return {
        db,
        ...schema,
        generatedLetters: schema.generatedLetters,
    };
});

import { db, generatedLetters } from '@/db';

describe('Letters Numbering API', () => {
    beforeEach(async () => {
        await db.delete(generatedLetters);
    });

    it('should return sequence 1 if none exists', async () => {
        const req = createMockRequest({
            method: 'POST',
            body: { classificationCode: '421' }
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.nextSequence).toBe(1);
    });

    it('should increment sequence within the same month', async () => {
        const now = new Date();
        await db.insert(generatedLetters).values({
            id: 'l1',
            classificationCode: '421',
            sequenceNumber: 5,
            letterNumber: '421/005/...',
            createdAt: now
        } as any);

        const req = createMockRequest({
            method: 'POST',
            body: { classificationCode: '421', date: now.toISOString() }
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.nextSequence).toBe(6);
    });

    it('should start at 1 for different month', async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        await db.insert(generatedLetters).values({
            id: 'l1',
            classificationCode: '421',
            sequenceNumber: 5,
            letterNumber: '421/005/...',
            createdAt: lastMonth
        } as any);

        const req = createMockRequest({
            method: 'POST',
            body: { classificationCode: '421', date: new Date().toISOString() }
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.nextSequence).toBe(1);
    });
});
