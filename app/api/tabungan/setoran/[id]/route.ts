"use server";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSetoranDetail, resubmitSetoran } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

/**
 * GET /api/tabungan/setoran/[id]
 * Get setoran detail with linked transactions
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const setoran = await getSetoranDetail(id);
        
        if (!setoran) {
            return NextResponse.json({ error: "Setoran tidak ditemukan" }, { status: 404 });
        }

        // Access control: only the guru who owns this setoran, bendahara, or admin can view
        const userRole = session.user.role;
        const userId = session.user.id;
        
        if (userRole !== "admin" && userRole !== "staff" && setoran.guruId !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ success: true, setoran });
    } catch (error) {
        return createErrorResponse(error);
    }
}

/**
 * PUT /api/tabungan/setoran/[id]
 * Resubmit a rejected setoran
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        // First, get the setoran to verify ownership
        const existing = await getSetoranDetail(id);
        if (!existing) {
            return NextResponse.json({ error: "Setoran tidak ditemukan" }, { status: 404 });
        }

        // Only the guru who owns this setoran can resubmit
        if (existing.guruId !== session.user.id && session.user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const updated = await resubmitSetoran(id, body.catatan);
        return NextResponse.json({ success: true, setoran: updated });
    } catch (error) {
        return createErrorResponse(error);
    }
}
