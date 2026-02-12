
import { NextResponse } from "next/server";
import { db, students, studentClasses } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { students: rawData } = body;

        if (!rawData || !Array.isArray(rawData)) {
             return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        // Fetch all classes to map names to IDs
        const allClasses = await db.select().from(studentClasses);
        const classMap = new Map(allClasses.map(c => [c.name.toLowerCase(), c.id])); 
        // Also map just incase they use ID or similar? For now map Name/Label -> ID

        // Define expected row interface
        interface StudentImportRow {
            fullName?: string;
            nama?: string;
            nis?: string | number;
            nisn?: string | number;
            nik?: string | number;
            gender?: string;
            jk?: string;
            className?: string;
            kelas?: string;
            status?: string;
            birthPlace?: string;
            tempat_lahir?: string;
            birthDate?: string | Date; // Assuming date string or object
            tanggal_lahir?: string | Date;
            religion?: string;
            agama?: string;
            address?: string;
            alamat?: string;
            fatherName?: string;
            nama_ayah?: string;
            fatherNik?: string | number;
            motherName?: string;
            nama_ibu?: string;
            motherNik?: string | number;
            guardianName?: string;
            nama_wali?: string;
            guardianNik?: string | number;
            guardianJob?: string;
            pekerjaan_wali?: string;
            parentPhone?: string | number;
        }

        const preparedData = (rawData as StudentImportRow[]).map((row) => {
            // Map keys loosely (handling Indo headers if template used differently, but our template uses keys)
            // Assuming the template we generate uses the object keys: fullName, nis, nisn, nik, gender, className, status
            
            // Resolve Class ID
            const className = row.className || row.kelas || "";
            let classId = null;
            if (className) {
                classId = classMap.get(className.toLowerCase());
            }

            return {
                fullName: (row.fullName || row.nama || "") as string,
                nis: row.nis ? String(row.nis) : null,
                nisn: row.nisn ? String(row.nisn) : null,
                nik: row.nik ? String(row.nik) : null,
                gender: ((row.gender === "L" || row.jk === "L") ? "L" : "P") as "L" | "P",
                classId: classId, // Link to real class
                className: className, // Keep legacy string too
                status: (row.status === "dropped_out" ? "dropped" : (row.status || "active")) as "active" | "graduated" | "dropped" | "transferred" | "deceased",
                
                // Detailed Info
                birthPlace: row.birthPlace || row.tempat_lahir || null,
                birthDate: row.birthDate ? new Date(row.birthDate).toISOString().split("T")[0] : (row.tanggal_lahir ? new Date(row.tanggal_lahir).toISOString().split("T")[0] : null),
                religion: row.religion || row.agama || null,
                address: row.address || row.alamat || null,

                // Parent Info
                fatherName: row.fatherName || row.nama_ayah || null,
                fatherNik: row.fatherNik ? String(row.fatherNik) : null,
                motherName: row.motherName || row.nama_ibu || null,
                motherNik: row.motherNik ? String(row.motherNik) : null,
                guardianName: row.guardianName || row.nama_wali || null,
                guardianNik: row.guardianNik ? String(row.guardianNik) : null,
                guardianJob: row.guardianJob || row.pekerjaan_wali || null,
                parentPhone: row.parentPhone ? String(row.parentPhone) : null,

                createdAt: new Date(),
                updatedAt: new Date(),
                // Generate QR Code if missing?
                qrCode: (row.nisn ? String(row.nisn) : (row.nis ? String(row.nis) : `TEMP-${Math.random().toString(36).substr(2,9)}`)) as string,
            };
        }).filter((d): d is typeof d & { fullName: string } => !!d.fullName); // Filter empty rows and narrow type

        if (preparedData.length === 0) {
             return NextResponse.json({ error: "No valid data to import" }, { status: 400 });
        }

        // Batch Insert
        // Note: SQLite/Drizzle might have limit on variables. If 1000 rows, chunk it.
        const CHUNK_SIZE = 50; 
        for (let i = 0; i < preparedData.length; i += CHUNK_SIZE) {
            const chunk = preparedData.slice(i, i + CHUNK_SIZE);
            await db.insert(students).values(chunk).onConflictDoNothing(); // Skip duplicates for now
        }

        return NextResponse.json({ success: true, count: preparedData.length });

    } catch (error) {
        console.error("Bulk Import Error:", error);
        return NextResponse.json({ error: "Failed to import students" }, { status: 500 });
    }
}
