import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb } from '../tests/test-utils';
import { spmbPeriods, spmbRegistrants } from '../db/schema/spmb';
import {
    getActivePeriod,
    getAllPeriods,
    getRegistrants,
    createRegistrant,
    generateRegistrationNumber,
    getSPMBStats
} from './spmb';

vi.mock('server-only', () => ({}));

vi.mock('@/db', async () => {
    const { createTestDb } = await import('../tests/test-utils');
    const { db } = createTestDb();
    return { db };
});

import { db } from '@/db';

async function cleanup() {
    await db.delete(spmbRegistrants);
    await db.delete(spmbPeriods);
}

const DEFAULT_REGISTRANT = {
    fullName: 'Test Student',
    studentNik: 'NIK123',
    kkNumber: 'KK123',
    birthDate: new Date(),
    birthPlace: 'Jakarta',
    gender: 'L' as const,
    religion: 'Islam',
    addressStreet: 'Jalan Test',
    addressRt: '01',
    addressRw: '01',
    addressVillage: 'Desa Test',
    address: 'Alamat Lengkap',
    parentPhone: '0812',
};

describe('SPMB Core Logic', () => {
    beforeEach(async () => {
        await cleanup();
    });

    it('should manage periods', async () => {
        await db.insert(spmbPeriods).values({
            name: 'Gelombang 1',
            academicYear: '2026/2027',
            year: 2026,
            isActive: true,
            startDate: new Date(),
            endDate: new Date(),
        } as any);

        const active = await getActivePeriod();
        expect(active?.name).toBe('Gelombang 1');

        const all = await getAllPeriods();
        expect(all.length).toBe(1);
    });

    it('should generate registration number', async () => {
        const num1 = await generateRegistrationNumber();
        expect(num1).toMatch(/SPMB-\d{4}-0001/);

        await db.insert(spmbRegistrants).values({
            ...DEFAULT_REGISTRANT,
            id: 'reg1',
            registrationNumber: num1,
            periodId: 'p1'
        } as any);

        const num2 = await generateRegistrationNumber();
        expect(num2).toMatch(/SPMB-\d{4}-0002/);
    });

    it('should manage registrants and stats', async () => {
        const [period] = await db.insert(spmbPeriods).values({
            id: 'p1',
            name: 'P1',
            academicYear: '2026/2027',
            year: 2026,
            isActive: true,
            startDate: new Date(),
            endDate: new Date(),
        } as any).returning();

        const reg = await createRegistrant({
            ...DEFAULT_REGISTRANT,
            fullName: 'Budi',
            studentNik: '3201',
            periodId: period.id,
            status: 'pending',
            registrationNumber: 'SPMB-2026-0001'
        } as any);

        expect(reg.fullName).toBe('Budi');

        const list = await getRegistrants({ search: 'Budi' });
        expect(list.totalItems).toBe(1);

        const stats = await getSPMBStats(period.id);
        expect(stats.total).toBe(1);
        expect(stats.pending).toBe(1);
    });

    it('should find and update registrants', async () => {
        const { getRegistrantByRegistrationNumber, getRegistrantByNik, getRegistrantById, updateRegistrant } = await import('./spmb');

        const [reg] = await db.insert(spmbRegistrants).values({
            ...DEFAULT_REGISTRANT,
            id: 'r-find',
            registrationNumber: 'SPMB-FIND-1',
            studentNik: 'NIK-FIND-1'
        } as any).returning();

        const byNum = await getRegistrantByRegistrationNumber('SPMB-FIND-1');
        expect(byNum?.id).toBe('r-find');

        const byNik = await getRegistrantByNik('NIK-FIND-1');
        expect(byNik?.id).toBe('r-find');

        const byId = await getRegistrantById('r-find');
        expect(byId?.fullName).toBe(DEFAULT_REGISTRANT.fullName);

        await updateRegistrant('r-find', { fullName: 'Updated Student' });
        const updated = await getRegistrantById('r-find');
        expect(updated?.fullName).toBe('Updated Student');
    });
});
