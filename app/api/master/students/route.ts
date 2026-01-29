
import { NextResponse } from "next/server";
import { db, students, studentClasses } from "@/db"; // Assuming exports are available
import { auth } from "@/auth";
import { eq, like, or, and, desc, sql } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin", "guru"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const q = searchParams.get("q") || "";
        const status = searchParams.get("status");
        const classId = searchParams.get("classId");

        const offset = (page - 1) * limit;

        // Build conditions
        const conditions = [];
        if (q) {
            conditions.push(or(
                like(students.fullName, `%${q}%`),
                like(students.nis, `%${q}%`),
                like(students.nisn, `%${q}%`),
                like(students.nik, `%${q}%`)
            ));
        }
        if (status) {
            conditions.push(eq(students.status, status as any));
        }
        if (classId) {
            conditions.push(eq(students.classId, classId));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Fetch Data with Join to Classes
        const data = await db.select({
            student: students,
            className: studentClasses.name,
            grade: studentClasses.grade
        })
        .from(students)
        .leftJoin(studentClasses, eq(students.classId, studentClasses.id))
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(students.updatedAt));

        // Count Total
        const totalRes = await db.select({ count: sql<number>`count(*)` })
            .from(students)
            .where(whereClause);
        const total = totalRes[0].count;

        return NextResponse.json({
            data: data.map(d => ({
                ...d.student,
                className: d.className || d.student.className, // Fallback to legacy string if joined is null
                grade: d.grade
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Error fetching students:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        
        // Basic Validation
        if (!body.fullName) {
            return NextResponse.json({ error: "Nama Lengkap wajib diisi" }, { status: 400 });
        }

        // Create Student
        const newStudent = await db.insert(students).values({
            ...body,
            // Ensure status defaults to active if not provided
            status: body.status || "active",
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        return NextResponse.json(newStudent[0]);

    } catch (error: any) {
        console.error("Error creating student:", error);
        // Handle Unique Constraints
        if (error.message?.includes("UNIQUE constraint")) {
            if (error.message.includes("students.nisn")) return NextResponse.json({ error: "NISN sudah terdaftar" }, { status: 409 });
            if (error.message.includes("students.nis")) return NextResponse.json({ error: "NIS sudah terdaftar" }, { status: 409 });
            if (error.message.includes("students.nik")) return NextResponse.json({ error: "NIK sudah terdaftar" }, { status: 409 });
        }
        return NextResponse.json({ error: "Gagal menyimpan data siswa" }, { status: 500 });
    }
}
