import { NextRequest, NextResponse } from "next/server";
import { getTabunganStats } from "@/lib/tabungan";

// GET /api/tabungan/stats
export async function GET(request: NextRequest) {
    try {
        const stats = await getTabunganStats();
        return NextResponse.json(stats);
    } catch (error) {
        console.error("Failed to fetch tabungan stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
