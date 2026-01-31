import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb } from '../tests/test-utils';
import { tabunganKelas, tabunganSiswa, tabunganTransaksi, tabunganBrankas, tabunganSetoran } from '../db/schema/tabungan';
import { users } from '../db/schema/users';
import {
    createKelas,
    getAllKelas,
    createSiswa,
    getSiswa,
    createTransaksi,
    getTabunganStats,
    verifySetoran,
    createSetoran
} from './tabungan';
import { eq } from 'drizzle-orm';

vi.mock('server-only', () => ({}));

vi.mock('@/db', async () => {
    const { createTestDb } = await import('../tests/test-utils');
    const { db } = createTestDb();
    return { db };
});

import { db } from '@/db';

async function cleanup() {
    await db.delete(tabunganTransaksi);
    await db.delete(tabunganSetoran);
    await db.delete(tabunganSiswa);
    await db.delete(tabunganKelas);
    await db.delete(tabunganBrankas);
    await db.delete(users);
}

describe('Tabungan Core Logic', () => {
    let testUser: any;
    let testKelas: any;

    beforeEach(async () => {
        await cleanup();
        [testUser] = await db.insert(users).values({
            id: 'user-1',
            email: 'guru@test.com',
            fullName: 'Guru Test',
            role: 'guru'
        } as any).returning();
        testKelas = await createKelas({
            nama: 'Kelas 1A',
            waliKelas: testUser.id
        });
    });

    it('should create and retrieve all kelas', async () => {
        const allKelas = await getAllKelas();
        expect(allKelas.length).toBe(1);
        expect(allKelas[0].nama).toBe('Kelas 1A');
        expect(allKelas[0].waliKelasUser?.name).toBe('Guru Test');
    });

    it('should create and retrieve siswa', async () => {
        const siswaData = {
            nama: 'Siswa 1',
            nisn: '12345678',
            kelasId: testKelas.id,
        };
        const newItem = await createSiswa(siswaData);
        expect(newItem.nama).toBe('Siswa 1');
        const result = await getSiswa(1, 10);
        expect(result.items.length).toBe(1);
    });

    it('should create transactions and update balance', async () => {
        const siswa = await createSiswa({
            nama: 'Siswa Transaksi',
            nisn: '8888',
            kelasId: testKelas.id,
        });

        await createTransaksi({
            siswaId: siswa.id,
            tipe: 'setor',
            nominal: 50000,
        } as any, testUser.id);

        const updatedSiswa = await db.query.tabunganSiswa.findFirst({
            where: eq(tabunganSiswa.id, siswa.id)
        });
        expect(updatedSiswa?.saldoTerakhir).toBe(50000);

        const stats = await getTabunganStats();
        expect(stats.totalSaldo).toBe(50000);
    });

    it('should complete setoran flow', async () => {
        const siswa = await createSiswa({
            nama: 'Siswa Setoran',
            nisn: '7777',
            kelasId: testKelas.id
        } as any);

        await createTransaksi({ siswaId: siswa.id, tipe: 'setor', nominal: 200000 } as any, testUser.id);
        const setoran = await createSetoran(testUser.id, 'Setoran Mingguan');

        const bendaharaId = 'bendahara-1';
        await db.insert(users).values({
            id: bendaharaId,
            email: 'bendahara@test.com',
            fullName: 'Bendahara Test',
            role: 'bendahara'
        } as any);

        const verified = await verifySetoran(setoran.id, 'verified', bendaharaId, 200000);
        expect(verified.status).toBe('verified');

        const [brankas] = await db.select().from(tabunganBrankas).where(eq(tabunganBrankas.tipe, 'cash'));
        expect(brankas.saldo).toBe(200000);
    });
});

describe('Tabungan Stats & Reports', () => {
    let testUser: any;
    let testKelas: any;
    let testSiswa: any;

    beforeEach(async () => {
        await cleanup();
        [testUser] = await db.insert(users).values({ id: 'u1', fullName: 'User 1', email: 'u1@test.com' } as any).returning();
        testKelas = await createKelas({ nama: 'K1', waliKelas: testUser.id });
        testSiswa = await createSiswa({ nama: 'S1', nisn: 'S1', kelasId: testKelas.id });
    });

    it('should get paginated siswa with search', async () => {
        await createSiswa({ nama: 'Target', nisn: 'T1', kelasId: testKelas.id });
        const result = await getSiswa(1, 10, { search: 'Target' });
        expect(result.totalItems).toBe(1);
        expect(result.items[0].nama).toBe('Target');
    });

    it('should handle brankas transfers', async () => {
        const { createOrUpdateBrankas, transferBrankas, getBrankasStats } = await import('./tabungan');
        const [b1] = await createOrUpdateBrankas({ nama: 'B1', saldo: 1000, tipe: 'cash' });
        const [b2] = await createOrUpdateBrankas({ nama: 'B2', saldo: 0, tipe: 'cash' });

        await transferBrankas(b1.id, b2.id, 400, testUser.id, 'setor_ke_bank');

        const stats = await getBrankasStats();
        expect(stats.find(b => b.id === b1.id)?.saldo).toBe(600);
        expect(stats.find(b => b.id === b2.id)?.saldo).toBe(400);
    });

    it('should generate trend and recent data', async () => {
        const { getTransactionTrend, getRecentTransactions, getSaldoByKelas } = await import('./tabungan');
        const tx = await createTransaksi({ siswaId: testSiswa.id, tipe: 'setor', nominal: 100 } as any, testUser.id);

        const trend = await getTransactionTrend(1);
        expect(trend[0].setor).toBe(100);

        const recent = await getRecentTransactions(5);
        expect(recent.length).toBe(1);

        const saldo = await getSaldoByKelas();
        expect(saldo.length).toBe(1);
        expect(saldo[0].value).toBe(100);
    });

    it('should handle student lookup by QR', async () => {
        const { getSiswaByQr, getSiswaByStudentId, linkSiswaToStudent } = await import('./tabungan');

        const s = await createSiswa({ nama: 'QR Student', nisn: 'Q1', kelasId: 'k1' });

        const byQr = await getSiswaByQr(s.qrCode);
        expect(byQr?.id).toBe(s.id);

        const bySid = await getSiswaByStudentId('master-id');
        expect(bySid).toBeNull();

        await linkSiswaToStudent(s.id, 'master-id');
        const bySidAfter = await getSiswaByStudentId('master-id');
        expect(bySidAfter?.id).toBe(s.id);
    });

    it('should perform CRUD on kelas', async () => {
        const { updateKelas, deleteKelas, getAllKelas } = await import('./tabungan');
        const [k1] = await db.insert(tabunganKelas).values({ nama: 'To Update' }).returning();

        await updateKelas(k1.id, { nama: 'Updated Name' });
        const all = await getAllKelas();
        expect(all.find(k => k.id === k1.id)?.nama).toBe('Updated Name');

        await deleteKelas(k1.id);
        const allAfter = await getAllKelas();
        expect(allAfter.find(k => k.id === k1.id)).toBeUndefined();
    });

    it('should perform CRUD on siswa', async () => {
        const { updateSiswa, deleteSiswa, getSiswaById } = await import('./tabungan');
        const s = await createSiswa({ nama: 'Siswa X', nisn: 'X1', kelasId: 'k1' });

        await updateSiswa(s.id, { nama: 'Siswa X Updated' });
        const updated = await getSiswaById(s.id);
        expect(updated?.nama).toBe('Siswa X Updated');

        await deleteSiswa(s.id);
        const deleted = await getSiswaById(s.id);
        expect(deleted).toBeNull();
    });

    it('should handle setoran and open transactions', async () => {
        const { getOpenTransactions, getSetoranList } = await import('./tabungan');

        await createTransaksi({ siswaId: testSiswa.id, tipe: 'setor', nominal: 1000 } as any, testUser.id);

        const open = await getOpenTransactions(testUser.id);
        expect(open.length).toBe(1);

        await createSetoran(testUser.id);
        const list = await getSetoranList();
        expect(list.length).toBe(1);
        expect(list[0].guruId).toBe(testUser.id);
    });

    it('should handle top savers', async () => {
        const { getTopSavers, getRecentTransactions } = await import('./tabungan');
        await createTransaksi({ siswaId: testSiswa.id, tipe: 'setor', nominal: 500 } as any, testUser.id);

        const top = await getTopSavers(5);
        expect(top.length).toBe(1);
        expect(top[0].saldo).toBe(500);

        const recent = await getRecentTransactions(5);
        expect(recent.length).toBe(1);
    });

    it('should create or update brankas', async () => {
        const { createOrUpdateBrankas } = await import('./tabungan');
        const [b1] = await createOrUpdateBrankas({ nama: 'New B', saldo: 100 });
        expect(b1.nama).toBe('New B');

        await createOrUpdateBrankas({ id: b1.id, nama: 'Updated B' });
        const [updated] = await db.select().from(tabunganBrankas).where(eq(tabunganBrankas.id, b1.id));
        expect(updated.nama).toBe('Updated B');
    });

    it('should handle stats error', async () => {
        const { getTabunganStats } = await import('./tabungan');
        // Temporarily mock db.select to throw
        const originalSelect = db.select;
        db.select = vi.fn().mockImplementation(() => { throw new Error('DB Error'); });

        const stats = await getTabunganStats();
        expect(stats.totalSiswa).toBe(0);

        db.select = originalSelect;
    });

    it('should handle saldo by kelas with no wali', async () => {
        const { getSaldoByKelas } = await import('./tabungan');
        await db.insert(tabunganSiswa).values({
            id: 's-no-wali',
            nama: 'S',
            nisn: 'SNW',
            kelasId: 'k-no-wali',
            saldoTerakhir: 1000,
            qrCode: 'QRNW'
        } as any);
        await db.insert(tabunganKelas).values({ id: 'k-no-wali', nama: 'Kelas No Wali' } as any);

        const saldo = await getSaldoByKelas();
        expect(saldo.find(s => s.name === 'Kelas No Wali')?.value).toBe(1000);
    });

    it('should handle rejected setoran and tarik from bendahara', async () => {
        const { createSetoran, verifySetoran } = await import('./tabungan');

        // Setup tarik transactions
        await createTransaksi({ siswaId: testSiswa.id, tipe: 'tarik', nominal: 500 } as any, testUser.id);
        const setoran = await createSetoran(testUser.id);
        expect(setoran.tipe).toBe('tarik_dari_bendahara');

        await verifySetoran(setoran.id, 'rejected', 'bend-1');
        const [updatedTx] = await db.select().from(tabunganTransaksi).where(eq(tabunganTransaksi.setoranId, setoran.id));
        expect(updatedTx).toBeUndefined(); // Should be unlinked (setoranId null)

        // Verify "tarik_dari_bendahara" path
        const setoran2 = await createSetoran(testUser.id);
        await db.insert(tabunganBrankas).values({ id: 'b-tarik', tipe: 'cash', saldo: 1000, nama: 'B' } as any);
        await verifySetoran(setoran2.id, 'verified', 'bend-1');
        const [brankas] = await db.select().from(tabunganBrankas).where(eq(tabunganBrankas.tipe, 'cash'));
        expect(brankas.saldo).toBe(500); // 1000 - 500
    });

    it('should get siswa with balance and setoran with status', async () => {
        const { getSiswaWithBalance, getSetoranList, getSiswaByStudentQRCode } = await import('./tabungan');

        // Student QR lookup
        const { students } = await import('../db/schema/students');
        await db.insert(students).values({ id: 'm-1', fullName: 'Master', qrCode: 'QRM' } as any);
        const s = await createSiswa({ nama: 'B1', nisn: 'B1', kelasId: 'k1', studentId: 'm-1' });

        const byMQr = await getSiswaByStudentQRCode('QRM');
        expect(byMQr?.id).toBe(s.id);

        const list = await getSiswaWithBalance('k1');
        expect(list.length).toBe(1);

        await db.insert(tabunganSetoran).values({ id: 's-v', guruId: 'g1', status: 'verified', tipe: 'setor_ke_bendahara', totalNominal: 0 } as any);
        const vList = await getSetoranList({ status: 'verified' });
        expect(vList.length).toBe(1);
    });
});
