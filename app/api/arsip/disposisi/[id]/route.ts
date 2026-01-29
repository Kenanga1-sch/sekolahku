import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { disposisi, suratMasuk } from "@/db/schema/arsip";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { isCompleted, completedNote } = body;

        // Ensure user is the assignee or admin
        // For MVP, we trust the frontend or allow updating if logged in.
        // Ideally: check if session.user.id === disposisi.toUserId

        const updates: any = {
            updatedAt: new Date(),
        };

        if (typeof isCompleted === "boolean") {
            updates.isCompleted = isCompleted;
            if (isCompleted) {
                updates.completedAt = new Date();
            } else {
                updates.completedAt = null;
            }
        }

        if (completedNote !== undefined) {
            updates.completedNote = completedNote;
        }

        const [updated] = await db.update(disposisi)
            .set(updates)
            .where(eq(disposisi.id, params.id))
            .returning();
            
        // Check if all dispositions for this surat are complete?
        // If so, update surat status to "Selesai" or "Arsip"?
        // Optional logic.

        return NextResponse.json(updated);

    } catch (error) {
        console.error("Error updating disposisi:", error);
        return NextResponse.json(
            { error: "Gagal mengupdate disposisi" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Logic: Only creator can delete?
        
        await db.delete(disposisi).where(eq(disposisi.id, params.id));
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error deleting disposisi:", error);
        return NextResponse.json(
            { error: "Gagal menghapus disposisi" },
            { status: 500 }
        );
    }
}
