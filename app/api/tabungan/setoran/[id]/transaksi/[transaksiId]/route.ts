"use server";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateTransaksiInBatch, getSetoranDetail } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

/**
 * PUT /api/tabungan/setoran/[id]/transaksi/[transaksiId]
 * Edit a transaction within a rejected batch
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transaksiId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id, transaksiId } = await params;
        const body = await request.json();

        // First, get the setoran to verify ownership
        const setoran = await getSetoranDetail(id);
        if (!setoran) {
            return NextResponse.json({ error: "Setoran tidak ditemukan" }, { status: 404 });
        }

        // Only the guru who owns this setoran can edit transactions
        if (setoran.guruId !== session.user.id && session.user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Verify transaction belongs to this setoran
        const txInBatch = setoran.transaksi?.find((t: { id: string }) => t.id === transaksiId);
        if (!txInBatch) {
            return NextResponse.json({ error: "Transaksi tidak ditemukan dalam setoran ini" }, { status: 404 });
        }

        const updated = await updateTransaksiInBatch(transaksiId, {
            nominal: body.nominal,
            catatan: body.catatan
        });

        return NextResponse.json({ success: true, transaksi: updated });
    } catch (error) {
        return createErrorResponse(error);
    }
}
