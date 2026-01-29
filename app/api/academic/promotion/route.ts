
import { NextResponse } from "next/server";
import { db, students, studentClasses, studentClassHistory } from "@/db"; // Assuming students table is imported here
import { auth } from "@/auth";
import { inArray, eq } from "drizzle-orm";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin", "guru"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { studentIds, targetClassId, actionType } = body; 
        
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: "Siswa tidak valid" }, { status: 400 });
        }

        // 1. Fetch CURRENT data for history
        // We need to know which class they are currently in to record it.
        const currentStudents = await db.select({
            id: students.id,
            classId: students.classId,
            className: students.className, // Legacy or joined? Let's assume joined for accuracy if possible, but students.className is fallback
            actualClassName: studentClasses.name,
            academicYear: studentClasses.academicYear,
            grade: studentClasses.grade,
        })
        .from(students)
        .leftJoin(studentClasses, eq(students.classId, studentClasses.id))
        .where(inArray(students.id, studentIds));

        // 2. Prepare History Records
        // Use system date for "recordDate", but use class Academic Year for "academicYear" context
        const historyRecords = currentStudents.map(s => ({
            studentId: s.id,
            classId: s.classId, // The class they are LEAVING
            className: s.actualClassName || s.className || "Unknown",
            academicYear: s.academicYear || "Unknown", // Fallback if no class
            grade: s.grade,
            status: actionType === 'promotion' ? 'promoted' : 'graduated',
            notes: actionType === 'promotion' 
                ? `Naik kelas ke ID ${targetClassId}` 
                : `Lulus dari sekolah`,
            promotedBy: session.user.id,
        }));

        // 3. Insert History (Batch)
        if (historyRecords.length > 0) {
            await db.insert(studentClassHistory).values(historyRecords as any); 
        }

        // 4. Update Students
        if (actionType === 'promotion') {
            if (!targetClassId) return NextResponse.json({ error: "Kelas tujuan wajib dipilih" }, { status: 400 });

            // Get Target Class Name for legacy sync (optional but good practice)
            const targetClass = await db.query.studentClasses.findFirst({
                where: eq(studentClasses.id, targetClassId),
                columns: { name: true }
            });

            await db.update(students)
                .set({ 
                    classId: targetClassId,
                    className: targetClass?.name, // Sync legacy field
                    status: 'active', // Ensure active
                    updatedAt: new Date()
                })
                .where(inArray(students.id, studentIds));

        } else if (actionType === 'graduation') {
            await db.update(students)
                .set({ 
                    status: 'graduated',
                    classId: null, 
                    // We preserve className as "Final Class" for reference, so we DON'T clear it or set it to null.
                    // But maybe we should update it to match the history? No, leave it as is.
                    updatedAt: new Date()
                })
                .where(inArray(students.id, studentIds));
        } else {
             return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
        }

        return NextResponse.json({ success: true, count: studentIds.length, historyCount: historyRecords.length });

    } catch (error) {
        console.error("Promotion Error:", error);
        return NextResponse.json({ error: "Gagal memproses kenaikan kelas" }, { status: 500 });
    }
}
