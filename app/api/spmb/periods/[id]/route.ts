
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { spmbPeriods, spmbRegistrants } from "@/db/schema/spmb";
import { eq, sql } from "drizzle-orm";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: idFromParams } = await params;
    try {
        const id = idFromParams;
        const body = await request.json();

        // Update the period
        const updatedPeriod = await db
            .update(spmbPeriods)
            .set({
                name: body.name,
                startDate: body.startDate ? new Date(body.startDate) : undefined,
                endDate: body.endDate ? new Date(body.endDate) : undefined,
                quota: body.quota ? parseInt(body.quota) : undefined,
                isActive: body.isActive,
                updatedAt: new Date(),
            })
            .where(eq(spmbPeriods.id, id))
            .returning();

        // If setting as active, deactivate others
        if (body.isActive) {
            await db
                .update(spmbPeriods)
                .set({ isActive: false })
                .where(sql`${spmbPeriods.id} != ${id}`);
        }

        return NextResponse.json({
            success: true,
            data: updatedPeriod[0],
        });
    } catch (error) {
        console.error("Error updating period:", error);
        return NextResponse.json(
            { success: false, error: "Gagal mengupdate periode" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: idFromParams } = await params;
    try {
        const id = idFromParams;
        
        // Check if there are registrants
        // Can be done via foreign key constraint handling or manual check
        const registrantCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(spmbRegistrants)
            .where(eq(spmbRegistrants.periodId, id));

        if (registrantCount[0].count > 0) {
             return NextResponse.json(
                { success: false, error: "Tidak dapat menghapus periode yang memiliki pendaftar." },
                { status: 400 }
            );
        }

        await db.delete(spmbPeriods).where(eq(spmbPeriods.id, id));

        return NextResponse.json({
            success: true,
            data: { id },
        });
    } catch (error) {
        console.error("Error deleting period:", error);
        return NextResponse.json(
            { success: false, error: "Gagal menghapus periode" },
            { status: 500 }
        );
    }
}
