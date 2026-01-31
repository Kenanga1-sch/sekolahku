
import { NextResponse } from "next/server";
import { db, studentClasses } from "@/db";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin", "guru", "staff"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, grade, capacity } = body;

        await db.update(studentClasses)
            .set({ 
                name, 
                grade: parseInt(grade),
                capacity: capacity ? parseInt(capacity) : 28,
                updatedAt: new Date()
            })
            .where(eq(studentClasses.id, id))
            .run();

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin", "guru", "staff"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await db.delete(studentClasses).where(eq(studentClasses.id, id)).run();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
