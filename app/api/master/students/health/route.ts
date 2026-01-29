
import { NextResponse } from "next/server";
import { db, students, studentDocuments } from "@/db";
import { count, isNull, or, eq, sql, and } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Total Active Students
        const totalResult = await db.select({ count: count() }).from(students).where(eq(students.status, 'active'));
        const totalStudents = totalResult[0].count;

        if (totalStudents === 0) {
            return NextResponse.json({ 
                totalStudents: 0, missingNik: 0, missingMother: 0, missingDocs: 0, completeness: 100 
            });
        }

        // Missing NIK
        const missingNikResult = await db.select({ count: count() }).from(students)
            .where(and(eq(students.status, 'active'), or(isNull(students.nik), eq(students.nik, ''))));
        const missingNik = missingNikResult[0].count;

        // Missing Mother
        const missingMotherResult = await db.select({ count: count() }).from(students)
            .where(and(eq(students.status, 'active'), or(isNull(students.motherName), eq(students.motherName, '-'))));
        const missingMother = missingMotherResult[0].count;

        // Missing Documents (Students who have NO documents)
        // This is tricky with simple join, let's just count unique studentIds in documents table
        // and subtract from total. But that's inaccurate if they have dummy doc.
        // Let's assume ANY doc is better than none.
        const studentsWithDocsResult = await db.select({ count: count() })
            .from(students)
            .where(and(
                eq(students.status, 'active'),
                sql`EXISTS (SELECT 1 FROM ${studentDocuments} WHERE ${studentDocuments.studentId} = ${students.id})`
            ));
        
        // Wait, SQLite EXISTS syntax might differ in Drizzle helper.
        // Let's use a simpler approach: Count distinct student_ids in documents table.
        // But we need to filter only ACTIVE students.
        // Correct SQL: SELECT count(*) FROM students WHERE status='active' AND id NOT IN (SELECT student_id FROM student_documents)
        
        const studentsWithoutDocsResult = await db.select({ count: count() })
            .from(students)
            .where(and(
                 eq(students.status, 'active'),
                 sql`NOT EXISTS (SELECT 1 FROM ${studentDocuments} WHERE ${studentDocuments}.student_id = ${students.id})`
            ));
        const missingDocs = studentsWithoutDocsResult[0].count;


        // Calculate Completeness Score (Rough Estimate)
        // 100 - (Penalty per missing item type)
        // Penalty weight: NIK=30%, Mother=20%, Docs=10% (scaled by ratio)
        
        const pctMissingNik = (missingNik / totalStudents);
        const pctMissingMother = (missingMother / totalStudents);
        const pctMissingDocs = (missingDocs / totalStudents);

        let score = 100;
        score -= (pctMissingNik * 30);
        score -= (pctMissingMother * 20);
        score -= (pctMissingDocs * 10);
        
        return NextResponse.json({
            totalStudents,
            missingNik,
            missingMother,
            missingDocs,
            completeness: Math.round(Math.max(0, score))
        });

    } catch (error) {
        console.error("Health Check Error:", error);
        return NextResponse.json({ error: "Error" }, { status: 500 });
    }
}
