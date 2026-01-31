import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createMockRequest } from '@/tests/api-test-utils';
import { spmbRegistrants } from '@/db/schema/spmb';

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('@/tests/test-utils');
    const { db } = createTestDb();
    return { db, ...schema };
});

import { db } from '@/db';

describe('API /api/spmb/registrants', () => {
    beforeEach(async () => {
        await db.delete(spmbRegistrants);
    });

    it('should return paginated registrants', async () => {
        await db.insert(spmbRegistrants).values({
            registrationNumber: 'SPMB-1',
            fullName: 'Student 1',
            studentNik: 'NIK-1',
            kkNumber: 'KK-1',
            birthDate: new Date(),
            birthPlace: 'Loc',
            gender: 'L',
            religion: 'Islam',
            addressStreet: 'St',
            addressRt: '01',
            addressRw: '01',
            addressVillage: 'Vil',
            address: 'Full',
            parentPhone: '08'
        } as any);

        const req = createMockRequest({ url: 'http://localhost/api/spmb/registrants?search=Student' });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.totalItems).toBe(1);
        expect(data.items[0].fullName).toBe('Student 1');
    });
});
