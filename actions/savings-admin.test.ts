import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb } from '../tests/test-utils';
import {
    schoolSettings,
    users,
    tabunganKelas,
    tabunganSetoran,
    tabunganTransaksi,
    tabunganSiswa,
    tabunganBrankas
} from '../db';
import {
    getEmployees,
    assignSavingsTreasurer,
    getSavingsTreasurer,
    assignClassRep,
    verifySetoran,
    transferVaultFunds
} from './savings-admin';
import { eq } from 'drizzle-orm';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('../tests/test-utils');
    const { db } = createTestDb();
    return { db, ...schema };
});

import { db } from '@/db';

async function cleanup() {
    await db.delete(tabunganTransaksi);
    await db.delete(tabunganSetoran);
    await db.delete(tabunganSiswa);
    await db.delete(tabunganKelas);
    await db.delete(tabunganBrankas);
    await db.delete(schoolSettings);
    await db.delete(users);
}

describe('Savings Admin Actions', () => {
    beforeEach(async () => {
        await cleanup();
    });

    it('should manage treasurer assignment', async () => {
        const [u1] = await db.insert(users).values({ id: 'u1', name: 'User 1', email: 'u1@test.com' } as any).returning();

        await assignSavingsTreasurer('u1');
        const treasurer = await getSavingsTreasurer();
        expect(treasurer.data?.id).toBe('u1');
    });

    it('should assign class reps', async () => {
        const [u1] = await db.insert(users).values({ id: 'u1', name: 'Guru 1', email: 'g1@test.com' } as any).returning();
        const [k1] = await db.insert(tabunganKelas).values({ nama: 'Kelas 1' }).returning();

        await assignClassRep(k1.id, 'u1');
        const [updated] = await db.select().from(tabunganKelas).where(eq(tabunganKelas.id, k1.id));
        expect(updated.waliKelas).toBe('u1');
    });

    it('should verify setoran and update transactions', async () => {
        const [s1] = await db.insert(tabunganSetoran).values({
            id: 'set-1',
            guruId: 'g1',
            tipe: 'setor_ke_bendahara',
            totalNominal: 1000,
            status: 'pending'
        } as any).returning();

        await db.insert(tabunganTransaksi).values({
            id: 'tx-1',
            siswaId: 's1',
            userId: 'g1',
            setoranId: 'set-1',
            tipe: 'setor',
            nominal: 1000,
            status: 'pending'
        } as any);

        await verifySetoran('set-1', 'bend-1');

        const [updatedSet] = await db.select().from(tabunganSetoran).where(eq(tabunganSetoran.id, 'set-1'));
        expect(updatedSet.status).toBe('verified');

        const [updatedTx] = await db.select().from(tabunganTransaksi).where(eq(tabunganTransaksi.id, 'tx-1'));
        expect(updatedTx.status).toBe('verified');
    });

    it('should handle vault fund transfers', async () => {
        const [cv] = await db.insert(tabunganBrankas).values({ nama: 'Kas', tipe: 'cash', saldo: 10000 }).returning();
        const [bv] = await db.insert(tabunganBrankas).values({ nama: 'Bank', tipe: 'bank', saldo: 5000 }).returning();

        // Setor ke bank: Cash -> Bank
        await transferVaultFunds('setor_ke_bank', 3000, 'admin-1');

        const [v1] = await db.select().from(tabunganBrankas).where(eq(tabunganBrankas.id, cv.id));
        const [v2] = await db.select().from(tabunganBrankas).where(eq(tabunganBrankas.id, bv.id));

        expect(v1.saldo).toBe(7000);
        expect(v2.saldo).toBe(8000);
    });

    it('should reject setoran', async () => {
        const { rejectSetoran } = await import('./savings-admin');
        const [s1] = await db.insert(tabunganSetoran).values({
            id: 'set-rej',
            guruId: 'g1',
            tipe: 'setor_ke_bendahara',
            totalNominal: 1000,
            status: 'pending'
        } as any).returning();

        await rejectSetoran('set-rej', 'Invalid amount');
        const [updated] = await db.select().from(tabunganSetoran).where(eq(tabunganSetoran.id, 'set-rej'));
        expect(updated.status).toBe('rejected');
        expect(updated.catatan).toContain('Invalid amount');
    });

    it('should handle vault summary and class reps listing', async () => {
        const { getBrankasSummary, getClassesWithReps, getEmployees } = await import('./savings-admin');

        const summary = await getBrankasSummary();
        expect(summary.success).toBe(true);

        const classes = await getClassesWithReps();
        expect(classes.success).toBe(true);

        const employees = await getEmployees();
        expect(employees.success).toBe(true);
    });

    it('should return error on missing vaults for transfer', async () => {
        const { transferVaultFunds } = await import('./savings-admin');
        const res = await transferVaultFunds('setor_ke_bank', 100, 'u1');
        expect(res.success).toBe(false);
        expect(res.error).toContain('tidak lengkap');
    });
});
