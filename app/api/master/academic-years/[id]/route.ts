
import { NextResponse } from "next/server";
import { db, academicYears } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: idFromParams } = await params;
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const id = idFromParams;
        const body = await req.json();

        // If setting as active, deactivate others
        if (body.isActive) {
            await db.update(academicYears).set({ isActive: false }).where(eq(academicYears.isActive, true));
        }

        const updated = await db.update(academicYears)
            .set({ 
                name: body.name,
                semester: body.semester,
                startDate: body.startDate,
                endDate: body.endDate,
                isActive: body.isActive,
                updatedAt: new Date()
            })
            .where(eq(academicYears.id, id))
            .returning();

        return NextResponse.json(updated[0]);

    } catch (error) {
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: idFromParams } = await params;
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const id = idFromParams;
        
        // Check if active?
        const check = await db.select().from(academicYears).where(eq(academicYears.id, id));
        if (check[0]?.isActive) {
             return NextResponse.json({ error: "Tidak bisa menghapus Tahun Ajaran Aktif" }, { status: 400 });
        }

        await db.delete(academicYears).where(eq(academicYears.id, id));
        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
