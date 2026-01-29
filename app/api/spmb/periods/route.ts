
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { spmbPeriods, spmbRegistrants } from "@/db/schema/spmb";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        // Fetch all periods
        const periods = await db
            .select()
            .from(spmbPeriods)
            .orderBy(desc(spmbPeriods.createdAt));

        // For each period, count registrants
        // We can do this with a separate query or a join/groupBy if supported well.
        // For simplicity and small number of periods, separate queries or a single group by query works.
        // Let's try a left join and count.
        
        const periodsWithCount = await db
            .select({
                id: spmbPeriods.id,
                name: spmbPeriods.name,
                academicYear: spmbPeriods.academicYear,
                startDate: spmbPeriods.startDate,
                endDate: spmbPeriods.endDate,
                quota: spmbPeriods.quota,
                isActive: spmbPeriods.isActive,
                createdAt: spmbPeriods.createdAt,
                updatedAt: spmbPeriods.updatedAt,
                registered: sql<number>`count(${spmbRegistrants.id})`.mapWith(Number),
            })
            .from(spmbPeriods)
            .leftJoin(spmbRegistrants, eq(spmbPeriods.id, spmbRegistrants.periodId))
            .groupBy(spmbPeriods.id)
            .orderBy(desc(spmbPeriods.createdAt));

        return NextResponse.json({
            success: true,
            data: periodsWithCount,
        });
    } catch (error) {
        console.error("Error fetching periods:", error);
        return NextResponse.json(
            { success: false, error: "Gagal mengambil data periode" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        const newPeriod = await db.insert(spmbPeriods).values({
            name: body.name,
            academicYear: body.name, // Using name as academicYear default
            startDate: new Date(body.startDate),
            endDate: new Date(body.endDate),
            quota: parseInt(body.quota),
            isActive: body.isActive,
        }).returning();

        // If newly created period is active, deactivate others
        if (body.isActive) {
             await db
                .update(spmbPeriods)
                .set({ isActive: false })
                .where(sql`${spmbPeriods.id} != ${newPeriod[0].id}`);
        }

        return NextResponse.json({
            success: true,
            data: newPeriod[0],
        });
    } catch (error) {
        console.error("Error creating period:", error);
        return NextResponse.json(
            { success: false, error: "Gagal membuat periode" },
            { status: 500 }
        );
    }
}
