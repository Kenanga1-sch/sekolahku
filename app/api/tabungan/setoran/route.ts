import { NextRequest, NextResponse } from "next/server";
import { createSetoran, getSetoranList } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

// GET /api/tabungan/setoran
// List setorans (optional filter by status)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as any;

    try {
        const items = await getSetoranList({ status });
        return NextResponse.json({ success: true, items });
    } catch (error) {
        return createErrorResponse(error);
    }
}

// POST /api/tabungan/setoran
// Create new setoran from pending transactions
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { guruId, catatan } = body;

        if (!guruId) {
            return NextResponse.json({ error: "Guru ID required" }, { status: 400 });
        }

        const setoran = await createSetoran(guruId, catatan);
        return NextResponse.json({ success: true, data: setoran });
    } catch (error) {
        return createErrorResponse(error);
    }
}
