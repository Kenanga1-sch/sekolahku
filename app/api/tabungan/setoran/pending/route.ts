import { NextRequest, NextResponse } from "next/server";
import { getOpenTransactions } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

// GET /api/tabungan/setoran/pending
// Query: ?guruId=...
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const guruId = searchParams.get("guruId");

    if (!guruId) {
        return NextResponse.json({ error: "Guru ID required" }, { status: 400 });
    }

    try {
        const transactions = await getOpenTransactions(guruId);
        return NextResponse.json({ success: true, items: transactions });
    } catch (error) {
        return createErrorResponse(error);
    }
}
