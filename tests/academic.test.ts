import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest } from './api-test-utils';
import { POST as promotePOST } from '../app/api/academic/promotion/route';
import { POST as candidatePromotePOST } from '../app/api/spmb/candidates/promote/route';
import { POST as academicYearPOST } from '../app/api/master/academic-years/route';
import { eq, inArray } from 'drizzle-orm';

vi.mock('server-only', () => ({}));

vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('./test-utils');
    const { db } = createTestDb();
    return {
        db,
        ...schema,
        students: schema.students,
        studentClasses: schema.studentClasses,
        studentClassHistory: schema.studentClassHistory,
        academicYears: schema.academicYears,
        users: schema.users
    };
});

import { db, students, studentClasses, studentClassHistory, academicYears, users } from '@/db';
import { auth } from '@/auth';

async function cleanup() {
    await db.delete(studentClassHistory);
    await db.delete(students);
    await db.delete(studentClasses);
    await db.delete(academicYears);
    await db.delete(users);
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

describe('Academic Logic - Promotion', () => {
    beforeEach(async () => {
        await cleanup();
        vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } } as any);
    });

    it('should promote students in bulk and record history', async () => {
        // 1. Setup Classes
        const [classA] = await db.insert(studentClasses).values({
            id: 'class-a',
            name: '1A',
            grade: 1,
            academicYear: '2024/2025'
        } as any).returning();

        const [classB] = await db.insert(studentClasses).values({
            id: 'class-b',
            name: '2A',
            grade: 2,
            academicYear: '2025/2026'
        } as any).returning();

        // 2. Setup Students
        const studentData = [
            { id: 's1', fullName: 'Student 1', classId: classA.id, className: '1A', studentNik: 'N1', nisn: 'NI1', kkNumber: 'K1', qrCode: 'Q1' },
            { id: 's2', fullName: 'Student 2', classId: classA.id, className: '1A', studentNik: 'N2', nisn: 'NI2', kkNumber: 'K2', qrCode: 'Q2' },
        ];
        await db.insert(students).values(studentData as any);

        // 3. Perform Promotion
        const req = createMockRequest({
            method: 'POST',
            body: {
                studentIds: ['s1', 's2'],
                targetClassId: classB.id,
                actionType: 'promotion'
            }
        });

        const res = await promotePOST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.count).toBe(2);

        // 4. Verify Student Update
        const updatedStudents = await db.select().from(students).where(inArray(students.id, ['s1', 's2']));
        expect(updatedStudents.every(s => s.classId === classB.id)).toBe(true);
        expect(updatedStudents.every(s => s.className === '2A')).toBe(true);

        // 5. Verify History
        const history = await db.select().from(studentClassHistory).where(inArray(studentClassHistory.studentId, ['s1', 's2']));
        expect(history.length).toBe(2);
        expect(history[0].status).toBe('promoted');
        expect(history[0].className).toBe('1A'); // Old class name
    });

    it('should handle graduation', async () => {
        await db.insert(students).values({
            id: 's3',
            fullName: 'Grad Student',
            classId: 'c1',
            className: '6',
            studentNik: 'N3',
            nisn: 'NI3',
            kkNumber: 'K3',
            qrCode: 'Q3'
        } as any);

        const req = createMockRequest({
            method: 'POST',
            body: {
                studentIds: ['s3'],
                actionType: 'graduation'
            }
        });

        const res = await promotePOST(req);
        const data = await res.json();

        expect(data.success).toBe(true);

        const [graduated] = await db.select().from(students).where(eq(students.id, 's3'));
        expect(graduated.status).toBe('graduated');
        expect(graduated.classId).toBeNull();
    });
});

describe('Academic Logic - Candidate Assignment', () => {
    beforeEach(async () => {
        await cleanup();
        vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } } as any);
    });

    it('should promote candidate from SPMB to student with class assignment', async () => {
        const { spmbRegistrants } = await import('@/db');

        // 1. Setup Class
        const [targetClass] = await db.insert(studentClasses).values({
            id: 'class-new',
            name: '1A',
            grade: 1,
            academicYear: '2024/2025'
        } as any).returning();

        // 2. Setup Registrant
        const [registrant] = await db.insert(spmbRegistrants).values({
            ...DEFAULT_REGISTRANT,
            id: 'reg-1',
            fullName: 'New Student',
            registrationNumber: 'SPMB-1',
            studentNik: 'NIK-NEW',
        } as any).returning();

        // 3. Promote Candidate
        const req = createMockRequest({
            method: 'POST',
            body: {
                registrationId: registrant.id,
                targetClassId: targetClass.id
            }
        });

        const res = await candidatePromotePOST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);

        // 4. Verify Student Record
        const [newStudent] = await db.select().from(students).where(eq(students.nik, 'NIK-NEW'));
        expect(newStudent.fullName).toBe('New Student');
        expect(newStudent.classId).toBe(targetClass.id);
        expect(newStudent.status).toBe('active');

        // 5. Verify History
        const history = await db.select().from(studentClassHistory).where(eq(studentClassHistory.studentId, newStudent.id));
        expect(history.length).toBe(1);
        expect(history[0].classId).toBe(targetClass.id);
    });
});

describe('Academic Logic - Academic Years', () => {
    beforeEach(async () => {
        await cleanup();
        vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } } as any);
    });

    it('should deactivate other academic years when a new active one is created', async () => {
        // Setup existing active year
        await db.insert(academicYears).values({
            id: 'y1',
            name: '2024/2025',
            semester: 'Ganjil',
            isActive: true
        } as any);

        const req = createMockRequest({
            method: 'POST',
            body: {
                name: '2025/2026',
                semester: 'Ganjil',
                isActive: true
            }
        });

        const res = await academicYearPOST(req);
        expect(res.status).toBe(200);

        const allYears = await db.select().from(academicYears);
        const oldYear = allYears.find(y => y.id === 'y1');
        const newYear = allYears.find(y => y.name === '2025/2026');

        expect(oldYear?.isActive).toBe(false);
        expect(newYear?.isActive).toBe(true);
    });
});
