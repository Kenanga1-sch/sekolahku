import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb } from '../tests/test-utils';
import {
    libraryCatalog,
    libraryAssets,
    libraryMembers,
    libraryLoans,
    libraryVisits
} from '../db/schema/library';
import { users } from '../db/schema/users';
import {
    getOrCreateCatalog,
    bindAsset,
    getLibraryAssets,
    borrowBook,
    returnBook,
    getLibraryStats,
    recordVisit,
    smartScanComplete
} from './library';
import { eq } from 'drizzle-orm';

vi.mock('server-only', () => ({}));

vi.mock('@/db', async () => {
    const { createTestDb } = await import('../tests/test-utils');
    const { db } = createTestDb();
    return { db };
});

import { db } from '@/db';

async function cleanup() {
    await db.delete(libraryLoans);
    await db.delete(libraryVisits);
    await db.delete(libraryAssets);
    await db.delete(libraryCatalog);
    await db.delete(libraryMembers);
    await db.delete(users);
}

describe('Library Logic', () => {
    beforeEach(async () => {
        await cleanup();
    });

    it('should manage catalog and assets', async () => {
        const catalog = await getOrCreateCatalog({
            title: 'Test Book',
            isbn: '123456'
        });
        expect(catalog.title).toBe('Test Book');

        const asset = await bindAsset('QR-1', catalog.id, 'Shelf A');
        expect(asset.id).toBe('QR-1');

        const list = await getLibraryAssets(1, 10, { search: 'Test' });
        expect(list.items.length).toBe(1);
    });

    it('should handle loans and returns', async () => {
        const [member] = await db.insert(libraryMembers).values({
            id: 'm1',
            name: 'Member 1',
            qrCode: 'MEM-1',
            isActive: true
        } as any).returning();

        const catalog = await getOrCreateCatalog({ title: 'Loan Book' });
        await bindAsset('QR-LOAN', catalog.id);

        const loan = await borrowBook(member.id, 'QR-LOAN');
        expect(loan.isReturned).toBe(false);

        const [asset] = await db.select().from(libraryAssets).where(eq(libraryAssets.id, 'QR-LOAN'));
        expect(asset.status).toBe('BORROWED');

        await returnBook(loan.id);
        const [assetAfter] = await db.select().from(libraryAssets).where(eq(libraryAssets.id, 'QR-LOAN'));
        expect(assetAfter.status).toBe('AVAILABLE');
    });

    it('should handle visits and smart scan', async () => {
        const [member] = await db.insert(libraryMembers).values({
            id: 'm2',
            name: 'Visitor 1',
            qrCode: 'MEM-2',
            isActive: true
        } as any).returning();

        const visit = await recordVisit(member.id);
        expect(visit.memberId).toBe(member.id);

        const scan = await smartScanComplete('MEM-2');
        expect(scan.type).toBe('member');
        expect(scan.visitStatus.isFirstVisit).toBe(false); // Since we just recorded it
    });

    it('should provide statistics', async () => {
        const catalog = await getOrCreateCatalog({ title: 'Stat Book' });
        await bindAsset('QR-STAT', catalog.id);

        const stats = await getLibraryStats();
        expect(stats.totalBooks).toBe(1);
        expect(stats.availableBooks).toBe(1);
    });

    it('should generate reports', async () => {
        const { getLoanReport, getVisitReport } = await import('./library');

        // Setup data
        const [cat] = await db.insert(libraryCatalog).values({ title: 'Report Book' } as any).returning();
        const [ast] = await db.insert(libraryAssets).values({ id: 'QR-REP', catalogId: cat.id } as any).returning();
        const [mem] = await db.insert(libraryMembers).values({
            id: 'm-rep',
            name: 'Member Rep',
            qrCode: 'QR-MEM-REP'
        } as any).returning();

        await db.insert(libraryLoans).values({
            memberId: mem.id,
            itemId: ast.id,
            borrowDate: new Date('2026-01-01'),
            dueDate: new Date('2026-01-08'),
            isReturned: false
        } as any);

        await db.insert(libraryVisits).values({
            memberId: mem.id,
            date: '2026-01-01',
            timestamp: new Date('2026-01-01T10:00:00Z')
        } as any);

        const loans = await getLoanReport('2026-01-01', '2026-01-31');
        expect(loans.length).toBe(1);
        expect(loans[0].itemTitle).toBe('Report Book');

        const visits = await getVisitReport('2026-01-01', '2026-01-31');
        expect(visits.length).toBe(1);
        expect(visits[0].memberName).toBe('Member Rep');
    });

    it('should handle overdue and active loans', async () => {
        const { getActiveLoans, getOverdueLoans, getMemberActiveLoans } = await import('./library');

        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 10);

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() - 3);

        await db.insert(libraryLoans).values({
            id: 'loan-overdue',
            memberId: 'm1',
            itemId: 'QR1',
            borrowDate: pastDate,
            dueDate: dueDate,
            isReturned: false
        } as any);

        const active = await getActiveLoans();
        expect(active.totalItems).toBe(1);

        const overdue = await getOverdueLoans();
        expect(overdue.length).toBe(1);

        const memberLoans = await getMemberActiveLoans('m1');
        expect(memberLoans.length).toBe(1);
    });

    it('should manage items and members', async () => {
        const { updateLibraryItem, deleteLibraryItem, createLibraryMember, getMemberByQRCode } = await import('./library');

        const [cat] = await db.insert(libraryCatalog).values({ title: 'Old' } as any).returning();
        const [ast] = await db.insert(libraryAssets).values({ id: 'BK-OLD', catalogId: cat.id } as any).returning();

        await updateLibraryItem('BK-OLD', { title: 'New' });
        const [updatedCat] = await db.select().from(libraryCatalog).where(eq(libraryCatalog.id, cat.id));
        expect(updatedCat.title).toBe('New');

        await deleteLibraryItem('BK-OLD');
        const [deletedAst] = await db.select().from(libraryAssets).where(eq(libraryAssets.id, 'BK-OLD'));
        expect(deletedAst).toBeUndefined();

        const mem = await createLibraryMember({ name: 'Budi', qrCode: 'QR-BUDI' });
        expect(mem.name).toBe('Budi');

        const found = await getMemberByQRCode('QR-BUDI');
        expect(found?.id).toBe(mem.id);
    });

    it('should lookup ISBN', async () => {
        const { lookupISBN } = await import('./library');

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                'ISBN:123': {
                    title: 'Fetch Book',
                    authors: [{ name: 'Author X' }],
                    publish_date: '2025'
                }
            })
        });

        const res = await lookupISBN('123');
        expect(res?.title).toBe('Fetch Book');
        expect(res?.author).toBe('Author X');
    });

    it('should swap asset code and preserve history', async () => {
        const { swapAssetCode, findLoanByItemId } = await import('./library');

        const catalog = await getOrCreateCatalog({ title: 'Swap Book' });
        await bindAsset('QR-OLD', catalog.id);

        const [mem] = await db.insert(libraryMembers).values({ id: 'm-swap', name: 'S', qrCode: 'MS' } as any).returning();
        await borrowBook(mem.id, 'QR-OLD');

        await swapAssetCode('QR-OLD', 'QR-NEW');

        const loan = await findLoanByItemId('QR-NEW');
        expect(loan?.itemId).toBe('QR-NEW');
        expect(loan?.memberId).toBe(mem.id);

        const [oldAst] = await db.select().from(libraryAssets).where(eq(libraryAssets.id, 'QR-OLD'));
        expect(oldAst).toBeUndefined();
    });
});
