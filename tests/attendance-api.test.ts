import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as scanPOST } from '@/app/api/attendance/scan/route';
import { POST as sessionPOST, GET as sessionGET } from '@/app/api/attendance/sessions/route';
import { POST as manualPOST } from '@/app/api/attendance/manual/route';
import { createMockRequest } from './api-test-utils';

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
        attendanceSessions: schema.attendanceSessions,
        attendanceRecords: schema.attendanceRecords,
        users: schema.users
    };
});

import { db, students, attendanceSessions, attendanceRecords, users } from '@/db';

describe('Attendance API', () => {
    beforeEach(async () => {
        await db.delete(attendanceRecords);
        await db.delete(attendanceSessions);
        await db.delete(students);
    });

    it('should create a new session and record attendance via QR scan', async () => {
        // 1. Create student
        const [student] = await db.insert(students).values({
            id: 'stu-1',
            fullName: 'Student One',
            className: 'Class A',
            qrCode: 'QR-123',
            status: 'active',
            gender: 'L',
        } as any).returning();

        // 2. Create session
        const sessionReq = createMockRequest({
            method: 'POST',
            body: {
                className: 'Class A',
                teacherName: 'Teacher X'
            }
        });
        const sessionRes = await sessionPOST(sessionReq);
        const sessionData = await sessionRes.json();
        expect(sessionRes.status).toBe(201);
        expect(sessionData.className).toBe('Class A');

        // 3. Scan QR
        const scanReq = createMockRequest({
            method: 'POST',
            body: {
                qrCode: 'QR-123'
            }
        });
        const scanRes = await scanPOST(scanReq);
        const scanData = await scanRes.json();

        expect(scanRes.status).toBe(200);
        expect(scanData.message).toBe('Attendance recorded successfully');
        expect(scanData.student.fullName).toBe('Student One');

        // 4. Verify record in DB
        const records = await db.select().from(attendanceRecords);
        expect(records.length).toBe(1);
        expect(records[0].studentId).toBe(student.id);
        expect(records[0].sessionId).toBe(sessionData.id);
    });

    it('should record attendance manually and update if exists', async () => {
        const [student] = await db.insert(students).values({
            id: 'stu-m',
            fullName: 'Manual Student',
            className: 'Class B',
            status: 'active',
            gender: 'P',
            qrCode: 'QR-M',
        } as any).returning();

        const [session] = await db.insert(attendanceSessions).values({
            id: 'sess-m',
            date: new Date().toISOString().split('T')[0],
            className: 'Class B',
            status: 'open',
        }).returning();

        // Record manually
        const manualReq = createMockRequest({
            method: 'POST',
            body: {
                sessionId: session.id,
                studentId: student.id,
                status: 'hadir'
            }
        });
        const res1 = await manualPOST(manualReq);
        expect(res1.status).toBe(200);
        const data1 = await res1.json();
        expect(data1.created).toBe(true);

        // Update record
        const updateReq = createMockRequest({
            method: 'POST',
            body: {
                sessionId: session.id,
                studentId: student.id,
                status: 'sakit',
                notes: 'Flu'
            }
        });
        const res2 = await manualPOST(updateReq);
        expect(res2.status).toBe(200);
        const data2 = await res2.json();
        expect(data2.updated).toBe(true);
        expect(data2.record.status).toBe('sakit');
        expect(data2.record.notes).toBe('Flu');
    });

    it('should fail if student QR is not found', async () => {
        const scanReq = createMockRequest({
            method: 'POST',
            body: {
                qrCode: 'NON-EXISTENT'
            }
        });
        const scanRes = await scanPOST(scanReq);
        expect(scanRes.status).toBe(404);
        const data = await scanRes.json();
        expect(data.error).toBe('Student not found with this QR code');
    });

    it('should fail if no active session for student class', async () => {
        await db.insert(students).values({
            id: 'stu-1',
            fullName: 'Student One',
            className: 'Class B',
            qrCode: 'QR-456',
            status: 'active',
            gender: 'L',
        } as any);

        const scanReq = createMockRequest({
            method: 'POST',
            body: {
                qrCode: 'QR-456'
            }
        });
        const scanRes = await scanPOST(scanReq);
        expect(scanRes.status).toBe(404);
        const data = await scanRes.json();
        expect(data.error).toBe("No active session found for this student's class");
    });

    it('should list sessions with filters', async () => {
        const today = new Date().toISOString().split('T')[0];
        await db.insert(attendanceSessions).values([
            { id: 's1', className: '1A', date: today, status: 'open' },
            { id: 's2', className: '2B', date: today, status: 'closed' }
        ]);

        const req = createMockRequest({
            method: 'GET',
            url: `http://localhost/api/attendance/sessions?class=1A&status=open`
        });
        const res = await sessionGET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.length).toBe(1);
        expect(data[0].className).toBe('1A');
    });
});
