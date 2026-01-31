
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

        const preparedData = rawData.map((row: any) => {
            // Map keys loosely (handling Indo headers if template used differently, but our template uses keys)
            // Assuming the template we generate uses the object keys: fullName, nis, nisn, nik, gender, className, status
            
            // Resolve Class ID
            const className = row.className || row.kelas || "";
            let classId = null;
            if (className) {
                classId = classMap.get(className.toLowerCase());
            }

            return {
                fullName: row.fullName || row.nama,
                nis: row.nis ? String(row.nis) : null,
                nisn: row.nisn ? String(row.nisn) : null,
                nik: row.nik ? String(row.nik) : null,
                gender: ((row.gender === "L" || row.jk === "L") ? "L" : "P") as "L" | "P",
                classId: classId, // Link to real class
                className: className, // Keep legacy string too
                status: row.status || "active",
                createdAt: new Date(),
                updatedAt: new Date(),
                // Generate QR Code if missing?
                qrCode: row.nisn || row.nis || `TEMP-${Math.random().toString(36).substr(2,9)}`, // Fallback
            };
        }).filter(d => d.fullName); // Filter empty rows

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
