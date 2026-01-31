import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb } from '../tests/test-utils';
import { loans, loanInstallments, employeeDetails, users, tabunganBrankas } from '../db';
import {
    createLoan,
    getLoans,
    approveLoan,
    addPayment
} from './loans';
import { eq } from 'drizzle-orm';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('../tests/test-utils');
    const { db } = createTestDb();
    return { db, ...schema };
});

import { auth } from '@/auth';
import { db } from '@/db';

async function cleanup() {
    await db.delete(loanInstallments);
    await db.delete(loans);
    await db.delete(employeeDetails);
    await db.delete(tabunganBrankas);
    await db.delete(users);
}

describe('Loan Actions', () => {
    beforeEach(async () => {
        await cleanup();
        vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } } as any);
    });

    it('should create loan for employee', async () => {
        await db.insert(users).values({ id: 'emp-1', fullName: 'Employee 1', email: 'emp@test.com' } as any);
        await db.insert(employeeDetails).values({ id: 'ed-1', userId: 'emp-1' } as any);

        const res = await createLoan({
            borrowerType: 'EMPLOYEE',
            employeeDetailId: 'ed-1',
            type: 'KASBON',
            amountRequested: 1000000,
            tenorMonths: 1
        });

        expect(res.success).toBe(true);
        const allLoans = await getLoans('RECEIVABLE');
        expect(allLoans.data?.length).toBe(1);
    });

    it('should approve loan and deduct from vault', async () => {
        const [v1] = await db.insert(tabunganBrankas).values({ nama: 'Kas', tipe: 'cash', saldo: 2000000 }).returning();
        const [l1] = await db.insert(loans).values({
            id: 'loan-1',
            borrowerType: 'EXTERNAL',
            borrowerName: 'Ext',
            amountRequested: 500000,
            type: 'KASBON',
            tenorMonths: 1,
            status: 'PENDING'
        } as any).returning();

        const res = await approveLoan('loan-1', 500000, v1.id);
        expect(res.success).toBe(true);

        const [updatedVault] = await db.select().from(tabunganBrankas).where(eq(tabunganBrankas.id, v1.id));
        expect(updatedVault.saldo).toBe(1500000);

        const [updatedLoan] = await db.select().from(loans).where(eq(loans.id, 'loan-1'));
        expect(updatedLoan.status).toBe('APPROVED');
    });

    it('should add payment and update vault', async () => {
        const [v1] = await db.insert(tabunganBrankas).values({ nama: 'Kas', tipe: 'cash', saldo: 1000000 }).returning();
        const [l1] = await db.insert(loans).values({
            id: 'loan-2',
            borrowerType: 'EXTERNAL',
            borrowerName: 'Ext',
            amountRequested: 500000,
            amountApproved: 500000,
            type: 'KASBON',
            tenorMonths: 1,
            status: 'APPROVED'
        } as any).returning();

        const res = await addPayment('loan-2', 100000, 'Cicilan 1', v1.id);
        expect(res.success).toBe(true);

        const [updatedVault] = await db.select().from(tabunganBrankas).where(eq(tabunganBrankas.id, v1.id));
        expect(updatedVault.saldo).toBe(1100000);

        const installments = await db.select().from(loanInstallments).where(eq(loanInstallments.loanId, 'loan-2'));
        expect(installments.length).toBe(1);
    });

    it('should reject loan and handle employee options', async () => {
        const { rejectLoan, getEmployeeOptions } = await import('./loans');
        const [l] = await db.insert(loans).values({
            id: 'loan-rej',
            borrowerType: 'EXTERNAL',
            borrowerName: 'E',
            amountRequested: 100,
            type: 'KASBON',
            tenorMonths: 1
        } as any).returning();

        await rejectLoan(l.id, 'Too many debts');
        const [updated] = await db.select().from(loans).where(eq(loans.id, l.id));
        expect(updated.status).toBe('REJECTED');
        expect(updated.rejectionReason).toBe('Too many debts');

        const opts = await getEmployeeOptions();
        expect(opts.success).toBe(true);
    });

    it('should handle vault and loan listing', async () => {
        const { getVaults, getLoans } = await import('./loans');
        await db.insert(tabunganBrankas).values({ nama: 'Vault 1', tipe: 'cash', saldo: 0 }).returning();

        const vaults = await getVaults();
        expect(vaults.data?.length).toBe(1);

        const payables = await getLoans('PAYABLE');
        expect(payables.success).toBe(true);
    });

    it('should return unauthorized if no session', async () => {
        vi.mocked(auth).mockResolvedValueOnce(null);
        const res = await createLoan({} as any);
        expect(res.success).toBe(false);
        expect(res.error).toBe('Unauthorized');
    });

    it('should handle validation errors', async () => {
        const res = await createLoan({ borrowerType: 'EMPLOYEE', amountRequested: 100 } as any);
        expect(res.success).toBe(false);
        expect(res.error).toContain('Pegawai wajib dipilih');

        const res2 = await createLoan({ borrowerType: 'EXTERNAL', amountRequested: 100 } as any);
        expect(res2.success).toBe(false);
        expect(res2.error).toContain('Nama Peminjam');
    });
});
