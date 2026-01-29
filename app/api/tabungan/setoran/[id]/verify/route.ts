import { NextRequest, NextResponse } from "next/server";
import { verifySetoran } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

// POST /api/tabungan/setoran/[id]/verify
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } // Standard Next.js 15+ params
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { status, bendaharaId } = body;

        if (!status || (status !== "verified" && status !== "rejected")) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
        
        if (!bendaharaId) {
            return NextResponse.json({ error: "Bendahara ID required" }, { status: 400 });
        }

        const result = await verifySetoran(id, status, bendaharaId);
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return createErrorResponse(error);
    }
}
