import { NextResponse } from "next/server";
import { db } from "@/db";
import { spmbPeriods, spmbRegistrants } from "@/db/schema/spmb";
import { eq, sql } from "drizzle-orm";

/**
 * Public API to get the currently active SPMB period
 * No authentication required
 */
export async function GET() {
    try {
        // Get the active period with registrant count
        const result = await db
            .select({
                id: spmbPeriods.id,
                name: spmbPeriods.name,
                academicYear: spmbPeriods.academicYear,
                startDate: spmbPeriods.startDate,
                endDate: spmbPeriods.endDate,
                quota: spmbPeriods.quota,
                isActive: spmbPeriods.isActive,
                registered: sql<number>`count(${spmbRegistrants.id})`.mapWith(Number),
            })
            .from(spmbPeriods)
            .leftJoin(spmbRegistrants, eq(spmbPeriods.id, spmbRegistrants.periodId))
            .where(eq(spmbPeriods.isActive, true))
            .groupBy(spmbPeriods.id)
            .limit(1);

        const period = result[0] || null;

        // Calculate if registration is open based on dates
        let isOpen = false;
        if (period) {
            const now = new Date();
            const startDate = new Date(period.startDate);
            const endDate = new Date(period.endDate);
            isOpen = now >= startDate && now <= endDate;
        }

        return NextResponse.json({
            success: true,
            period,
            isOpen,
        });
    } catch (error) {
        console.error("Error fetching active period:", error);
        return NextResponse.json(
            { success: false, error: "Gagal mengambil data periode aktif" },
            { status: 500 }
        );
    }
}
