import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb } from '../tests/test-utils';
import { financeAccounts, financeCategories, financeTransactions, users } from '../db';
import {
    getAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    createTransaction,
    getTransactions
} from './finance';
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
    await db.delete(financeTransactions);
    await db.delete(financeCategories);
    await db.delete(financeAccounts);
    await db.delete(users);
}

describe('Finance Actions', () => {
    beforeEach(async () => {
        await cleanup();
        vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } } as any);
    });

    it('should manage accounts', async () => {
        const createRes = await createAccount({
            name: 'Kas Utama',
            initialBalance: 1000000
        });
        expect(createRes.success).toBe(true);

        const accountsRes = await getAccounts();
        expect(accountsRes.success).toBe(true);
        expect(accountsRes.data?.length).toBe(1);
        expect(accountsRes.data?.[0].name).toBe('Kas Utama');

        const accId = accountsRes.data?.[0].id!;
        await updateAccount(accId, { name: 'Kas Kecil' });

        const updated = await db.query.financeAccounts.findFirst({ where: eq(financeAccounts.id, accId) });
        expect(updated?.name).toBe('Kas Kecil');

        // Transactions should be created for initial balance
        const txs = await getTransactions({ accountId: accId });
        expect(txs.data?.length).toBe(1);
        expect(txs.data?.[0].amount).toBe(1000000);
    });

    it('should handle transactions', async () => {
        const [acc1] = await db.insert(financeAccounts).values({ name: 'Acc 1' }).returning();
        const [acc2] = await db.insert(financeAccounts).values({ name: 'Acc 2' }).returning();
        const [cat1] = await db.insert(financeCategories).values({ name: 'Food', type: 'EXPENSE' }).returning();

        // Income
        await createTransaction({
            type: 'INCOME',
            accountIdSource: acc1.id,
            amount: 5000,
            description: 'Gift'
        });

        // Expense
        await createTransaction({
            type: 'EXPENSE',
            accountIdSource: acc1.id,
            categoryId: cat1.id,
            amount: 2000
        });

        // Transfer
        await createTransaction({
            type: 'TRANSFER',
            accountIdSource: acc1.id,
            accountIdDest: acc2.id,
            amount: 1000
        });

        const allTx = await getTransactions();
        expect(allTx.data?.length).toBe(3);
    });

    it('should prevent deleting accounts with transactions', async () => {
        const [acc] = await db.insert(financeAccounts).values({ name: 'Busy Acc' }).returning();
        await db.insert(financeTransactions).values({
            type: 'INCOME',
            accountIdSource: acc.id,
            amount: 100,
            createdBy: 'admin-1'
        });

        const delRes = await deleteAccount(acc.id);
        expect(delRes.success).toBe(false);
        expect(delRes.error).toContain('riwayat transaksi');
    });

    it('should handle categories', async () => {
        const { createCategory, getCategories, updateCategory, deleteCategory } = await import('./finance');

        await createCategory({ name: 'In1', type: 'INCOME' });
        const res = await getCategories('INCOME');
        expect(res.data?.length).toBe(1);

        const catId = res.data?.[0].id!;
        await updateCategory(catId, { name: 'InUpdated', type: 'INCOME' });

        const updated = await db.query.financeCategories.findFirst({ where: eq(financeCategories.id, catId) });
        expect(updated?.name).toBe('InUpdated');

        await deleteCategory(catId);
        const resAfter = await getCategories();
        expect(resAfter.data?.length).toBe(0);
    });

    it('should generate report transactions', async () => {
        const { getReportTransactions } = await import('./finance');
        const [acc] = await db.insert(financeAccounts).values({ name: 'Report Acc' }).returning();
        await db.insert(financeTransactions).values({
            type: 'INCOME',
            accountIdSource: acc.id,
            amount: 500,
            status: 'APPROVED',
            date: new Date(),
            createdBy: 'admin-1'
        } as any);

        const start = new Date();
        start.setDate(start.getDate() - 1);
        const end = new Date();
        end.setDate(end.getDate() + 1);

        const report = await getReportTransactions({ accountId: acc.id, startDate: start, endDate: end });
        expect(report.data?.length).toBe(1);
    });

    it('should manage individual transactions', async () => {
        const { updateTransaction, deleteTransaction, approveTransaction } = await import('./finance');
        const [acc] = await db.insert(financeAccounts).values({ name: 'T' }).returning();
        const [tx] = await db.insert(financeTransactions).values({
            type: 'INCOME',
            accountIdSource: acc.id,
            amount: 100,
            status: 'PENDING',
            createdBy: 'admin-1'
        } as any).returning();

        await approveTransaction(tx.id);
        const [approved] = await db.select().from(financeTransactions).where(eq(financeTransactions.id, tx.id));
        expect(approved.status).toBe('APPROVED');

        await updateTransaction(tx.id, { amount: 200 });
        const [updated] = await db.select().from(financeTransactions).where(eq(financeTransactions.id, tx.id));
        expect(updated.amount).toBe(200);

        await deleteTransaction(tx.id);
        const [deleted] = await db.select().from(financeTransactions).where(eq(financeTransactions.id, tx.id));
        expect(deleted).toBeUndefined();
    });

    it('should return unauthorized if no session', async () => {
        vi.mocked(auth).mockResolvedValueOnce(null);
        const res = await getAccounts();
        expect(res.success).toBe(false);
        expect(res.error).toBe('Unauthorized');
    });
});
