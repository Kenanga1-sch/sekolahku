
import { NextResponse } from "next/server";
import { db, studentClasses } from "@/db";
import { auth } from "@/auth";

// GET /api/academic/classes
export async function GET() {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const classes = await db.select().from(studentClasses).orderBy(studentClasses.name);
        return NextResponse.json(classes);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
    }
}

// POST /api/academic/classes
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin", "guru", "staff"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, grade, academicYear, capacity } = body;

        if (!name || !grade) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        const newClass = await db.insert(studentClasses).values({
            name,
            grade: parseInt(grade),
            academicYear: academicYear || "2024/2025",
            capacity: capacity ? parseInt(capacity) : 28,
            isActive: true,
        }).returning();

        return NextResponse.json(newClass[0]);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
    }
}
