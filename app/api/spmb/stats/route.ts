import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { spmbRegistrants } from "@/db/schema/spmb";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const [stats] = await db
            .select({
                total: sql<number>`count(*)`,
                pending: sql<number>`sum(case when ${spmbRegistrants.status} = 'pending' then 1 else 0 end)`,
                verified: sql<number>`sum(case when ${spmbRegistrants.status} = 'verified' then 1 else 0 end)`,
                accepted: sql<number>`sum(case when ${spmbRegistrants.status} = 'accepted' then 1 else 0 end)`,
                rejected: sql<number>`sum(case when ${spmbRegistrants.status} = 'rejected' then 1 else 0 end)`,
            })
            .from(spmbRegistrants);
            
        // Use 0 if null (case when returns null if no match in some SQL dialects, though sum usually returns null if no rows or boolean logic)
        // SQLite sum returning null if no rows match?
        // Let's handle it safely.
        
        const safeStats = {
            total: stats?.total || 0,
            pending: stats?.pending || 0,
            verified: stats?.verified || 0,
            accepted: stats?.accepted || 0,
            rejected: stats?.rejected || 0,
        };

        return NextResponse.json(safeStats);

    } catch (error) {
        console.error("Failed to fetch spmb stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
