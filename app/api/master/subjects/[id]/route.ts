
import { NextResponse } from "next/server";
import { db, subjects } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = params;
        const body = await req.json();

        const updated = await db.update(subjects)
            .set({ 
                code: body.code, 
                name: body.name, 
                category: body.category,
                description: body.description,
                updatedAt: new Date()
            })
            .where(eq(subjects.id, id))
            .returning();

        return NextResponse.json(updated[0]);

    } catch (error) {
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = params;
        await db.delete(subjects).where(eq(subjects.id, id));
        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
