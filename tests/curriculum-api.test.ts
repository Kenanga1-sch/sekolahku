import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/kurikulum/grades/route';
import { createMockRequest } from './api-test-utils';

vi.mock('@/db', async () => {
    const { createTestDb, schema } = await import('./test-utils');
    const { db } = createTestDb();
    return {
        db,
        ...schema,
        students: schema.students,
        studentGrades: schema.studentGrades,
        teacherTp: schema.teacherTp,
    };
});

import { db, students, studentGrades, teacherTp } from '@/db';

describe('Curriculum Grades API', () => {
    beforeEach(async () => {
        await db.delete(studentGrades);
        await db.delete(teacherTp);
        await db.delete(students);
    });

    it('should save and retrieve grades', async () => {
        // 1. Setup Student
        const [student] = await db.insert(students).values({
            id: 's1',
            fullName: 'Student One',
            qrCode: 'Q1'
        } as any).returning();

        // 2. Setup TP
        const [tp] = await db.insert(teacherTp).values({
            id: 'tp1',
            teacherId: 't1',
            code: 'TP1',
            content: 'Content',
            semester: 1,
            subject: 'Math',
            gradeLevel: 1
        }).returning();

        // 3. Post Grades
        const postReq = createMockRequest({
            method: 'POST',
            body: {
                tpId: tp.id,
                grades: [
                    { studentId: student.id, score: 85, type: 'FORMATIVE', notes: 'Good' }
                ]
            }
        });
        const postRes = await POST(postReq);
        expect(postRes.status).toBe(200);

        // 4. Get Grades
        const getReq = createMockRequest({
            method: 'GET',
            url: `http://localhost/api/kurikulum/grades?tpId=${tp.id}`
        });
        const getRes = await GET(getReq);
        const getData = await getRes.json();

        expect(getData.success).toBe(true);
        expect(getData.data.length).toBe(1);
        expect(getData.data[0].studentName).toBe('Student One');
        expect(getData.data[0].score).toBe(85);
    });

    it('should update existing grades', async () => {
        const [student] = await db.insert(students).values({ id: 's2', fullName: 'S2', qrCode: 'Q2' } as any).returning();
        const [tp] = await db.insert(teacherTp).values({
            id: 'tp2', teacherId: 't1', code: 'TP2', content: 'C', semester: 1, subject: 'S', gradeLevel: 1
        }).returning();

        // Initial score
        await db.insert(studentGrades).values({
            tpId: tp.id,
            studentId: student.id,
            score: 70,
            type: 'FORMATIVE'
        });

        // Update score
        const postReq = createMockRequest({
            method: 'POST',
            body: {
                tpId: tp.id,
                grades: [{ studentId: student.id, score: 90, type: 'FORMATIVE' }]
            }
        });
        await POST(postReq);

        const getReq = createMockRequest({
            method: 'GET',
            url: `http://localhost/api/kurikulum/grades?tpId=${tp.id}`
        });
        const getRes = await GET(getReq);
        const getData = await getRes.json();
        expect(getData.data[0].score).toBe(90);
    });
});
