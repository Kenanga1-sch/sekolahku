import { NextRequest, NextResponse } from "next/server";
import { getBrankasStats, createOrUpdateBrankas } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

// GET /api/tabungan/brankas
export async function GET(request: NextRequest) {
    try {
        const stats = await getBrankasStats(); // Update this fn too
        return NextResponse.json({ success: true, data: stats });
    } catch (error) {
        return createErrorResponse(error);
    }
}

// POST /api/tabungan/brankas
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("Brankas POST Payload:", body); // Debug log

        const res = await createOrUpdateBrankas(body);
        return NextResponse.json({ success: true, data: res });
    } catch (error) {
        console.error("Brankas POST Error:", error); // Debug log
        return createErrorResponse(error);
    }
}
