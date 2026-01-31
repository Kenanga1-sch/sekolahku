import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET, POST } from './route';
import { createMockRequest } from '@/tests/api-test-utils';
import { tabunganSiswa, tabunganKelas } from '@/db/schema/tabungan';

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('@/tests/test-utils');
    const { db } = createTestDb();
    return { db, ...schema };
});

import { db } from '@/db';

describe('API /api/tabungan/siswa', () => {
    beforeEach(async () => {
        await db.delete(tabunganSiswa);
        await db.delete(tabunganKelas);
    });

    it('should return list of students', async () => {
        await db.insert(tabunganSiswa).values({
            id: 's1',
            nama: 'Siswa 1',
            nisn: '123',
            qrCode: 'QR1',
            kelasId: 'k1'
        } as any);

        const req = createMockRequest({ url: 'http://localhost/api/tabungan/siswa?search=Siswa' });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.items.length).toBe(1);
    });

    it('should create a new student', async () => {
        const body = {
            nama: 'Budi',
            nisn: '456',
            kelasId: 'k1'
        };

        const req = createMockRequest({ method: 'POST', body });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.nama).toBe('Budi');
    });
});
