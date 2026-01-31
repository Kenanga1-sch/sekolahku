import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/arsip/surat-masuk/route';
import { createMockRequest } from './api-test-utils';

vi.mock('fs/promises', () => ({
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    default: {
        writeFile: vi.fn(),
        mkdir: vi.fn(),
    }
}));

vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('./test-utils');
    const { db } = createTestDb();
    return {
        db,
        ...schema,
        suratMasuk: schema.suratMasuk,
        klasifikasiSurat: schema.klasifikasiSurat,
    };
});

import { db, suratMasuk, klasifikasiSurat } from '@/db';
import { auth } from '@/auth';

describe('Arsip (Surat Masuk) API', () => {
    beforeEach(async () => {
        await db.delete(suratMasuk);
    });

    it('should list incoming letters', async () => {
        await db.insert(suratMasuk).values({
            id: 'sm1',
            agendaNumber: 'AGD/2024/001',
            originalNumber: '123/X/2024',
            sender: 'Dept A',
            subject: 'Test Letter',
            dateOfLetter: '2024-01-01',
            receivedAt: new Date(),
            filePath: '/uploads/test.pdf',
            status: 'Menunggu Disposisi'
        } as any);

        const req = createMockRequest({
            method: 'GET',
            url: 'http://localhost/api/arsip/surat-masuk'
        });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.items.length).toBe(1);
        expect(data.items[0].subject).toBe('Test Letter');
    });

    it('should reject unauthorized access', async () => {
        vi.mocked(auth).mockResolvedValue(null);

        const req = createMockRequest({ method: 'POST' });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });
});
