
import { NextResponse } from "next/server";
import { db, students, spmbRegistrants, studentClassHistory, studentClasses } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        // Allow admin or superadmin
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { registrationId, targetClassId } = body;

        if (!registrationId) return NextResponse.json({ error: "Registrasi ID tidak valid" }, { status: 400 });
        if (!targetClassId) return NextResponse.json({ error: "Kelas tujuan wajib dipilih" }, { status: 400 });

        // 1. Fetch Registrant Data
        const registrant = await db.query.spmbRegistrants.findFirst({
            where: eq(spmbRegistrants.id, registrationId)
        });

        if (!registrant) return NextResponse.json({ error: "Data pendaftar tidak ditemukan" }, { status: 404 });

        // 2. Fetch Target Class
        const targetClass = await db.query.studentClasses.findFirst({
            where: eq(studentClasses.id, targetClassId)
        });
        if (!targetClass) return NextResponse.json({ error: "Kelas tidak valid" }, { status: 400 });

        // 3. Create Student (Transaction-like steps)
        // Check if NIK already exists in students to prevent duplicate
        const existingStudent = await db.query.students.findFirst({
             where: eq(students.nik, registrant.studentNik)
        });

        if (existingStudent) {
            // Already exists? Maybe just update class/status?
            // For safety, let's reject or return the existing one.
            return NextResponse.json({ error: "Siswa dengan NIK ini sudah terdaftar sebagai siswa aktif" }, { status: 409 });
        }

        // Generate NIS? For now let user handle NIS or generate placeholder
        // TODO: Auto-generate NIS logic (e.g. Year + Sequence). 
        // For MVP, leave NIS empty or auto-generate simple one.
        // Let's generate a placeholder NIS based on timestamp if null.
        const newNis = registrant.nisn || `NIS-${Date.now()}`;

        const [newStudent] = await db.insert(students).values({
            fullName: registrant.fullName,
            nisn: registrant.nisn,
            nis: newNis, // Must be unique
            nik: registrant.studentNik,
            gender: registrant.gender,
            birthPlace: registrant.birthPlace,
            birthDate: registrant.birthDate ? registrant.birthDate.toISOString().split('T')[0] : null, // Format YYYY-MM-DD
            address: registrant.addressStreet, // Map street to address
            religion: registrant.religion,
            
            // Parents
            fatherName: registrant.fatherName,
            fatherNik: registrant.fatherNik,
            motherName: registrant.motherName,
            motherNik: registrant.motherNik,
            guardianName: registrant.guardianName,
            guardianNik: registrant.guardianNik,
            guardianJob: registrant.guardianJob,
            parentPhone: registrant.parentPhone,

            // Class & Status
            classId: targetClassId,
            className: targetClass.name, // Sync legacy
            status: 'active',
            enrolledAt: new Date(),
            
            // Metadata
            metaData: {
                spmbRegistrationId: registrant.id,
                source: "SPMB Promotion"
            },
            
            // Photo - If SPMB had photo upload logic, map it here. Assuming none for now or default.
            photo: null, 
            qrCode: `QR-${registrant.studentNik}` // Generate QR code string
        }).returning();

        // 4. Record History
        await db.insert(studentClassHistory).values({
            studentId: newStudent.id,
            classId: targetClassId,
            className: targetClass.name,
            academicYear: targetClass.academicYear,
            grade: targetClass.grade,
            status: 'promoted',
            notes: `Promosi Siswa Baru dari SPMB (Reg: ${registrant.registrationNumber})`,
            promotedBy: session.user.id
        });

        // 5. Update Registrant Status to 'enrolled' (Wait, enum doesn't have 'enrolled', let's check schema)
        // Schema enum: draft, pending, verified, accepted, rejected.
        // We probably shouldn't change status to something invalid.
        // Or we should update schema. For now, let's assume 'accepted' is final state, 
        // OR we add a note? 
        // Ideally we add 'enrolled' to user enum, but that requires migration. 
        // Let's keep it 'accepted' but maybe add a flag or just rely on the link.
        // Wait, schema says: status: text enum.
        
        // Let's NOT failing due to enum. Just keep it 'accepted'. 
        // A better approach: We should know they are already promoted.
        // Maybe we store 'studentId' in spmb table? Schema doesn't have it.
        // For now, simply return success. Ideally, we shouldn't show them again in "Promote List".
        
        return NextResponse.json({ success: true, studentId: newStudent.id });

    } catch (error: any) {
        console.error("Promote Error:", error);
        if (error.message?.includes("UNIQUE")) {
             return NextResponse.json({ error: "Data duplikat (NIK/NISN sudah ada)" }, { status: 409 });
        }
        return NextResponse.json({ error: "Gagal memproses siswa" }, { status: 500 });
    }
}
