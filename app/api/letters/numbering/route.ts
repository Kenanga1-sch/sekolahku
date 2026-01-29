
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generatedLetters } from "@/db/schema/letters";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { startOfMonth, endOfMonth } from "date-fns";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { classificationCode, date } = body; // date is ISO string

        if (!classificationCode) {
            return NextResponse.json({ nextSequence: 1 });
        }

        const targetDate = date ? new Date(date) : new Date();
        const start = startOfMonth(targetDate);
        const end = endOfMonth(targetDate);

        // Count letters with this code in this month
        // We want the MAX sequence number used, to increment.
        // OR count? Usually MAX is safer if deletions happen.
        // But if we reset every month, we need to check MAX for THIS MONTH.
        
        // Note: created_at in DB is timestamp.
        
        const result = await db.select({
            maxSeq: sql<number>`MAX(${generatedLetters.sequenceNumber})`
        })
        .from(generatedLetters)
        .where(
            and(
                eq(generatedLetters.classificationCode, classificationCode),
                gte(generatedLetters.createdAt, start),
                lte(generatedLetters.createdAt, end)
            )
        );

        const currentMax = result[0]?.maxSeq || 0;
        const nextSequence = currentMax + 1;

        return NextResponse.json({ nextSequence });

    } catch (error) {
        console.error("Failed to calculate number:", error);
        return NextResponse.json({ error: "Calculation failed" }, { status: 500 });
    }
}
