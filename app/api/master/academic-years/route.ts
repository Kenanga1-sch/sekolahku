
import { NextResponse } from "next/server";
import { db, academicYears } from "@/db";
import { auth } from "@/auth";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await db.select().from(academicYears).orderBy(desc(academicYears.name));
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "Error fetching data" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        
        // If setting as active, deactivate others
        if (body.isActive) {
            await db.update(academicYears).set({ isActive: false });
        }

        const newYear = await db.insert(academicYears).values({
            name: body.name, // "2024/2025"
            semester: body.semester, // "Ganjil"
            startDate: body.startDate,
            endDate: body.endDate,
            isActive: body.isActive || false,
        }).returning();

        return NextResponse.json(newYear[0]);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create academic year" }, { status: 500 });
    }
}
