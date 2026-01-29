import { NextRequest, NextResponse } from "next/server";
import { updateTransaksiStatus } from "@/lib/tabungan";

// POST /api/tabungan/transaksi/[id]/verify
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } // Standard Next.js 15+ params
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { status, userId } = body;

        if (!status || (status !== "verified" && status !== "rejected")) {
             return NextResponse.json(
                { error: "Invalid status. Must be 'verified' or 'rejected'." },
                { status: 400 }
            );
        }

        const updatedTx = await updateTransaksiStatus(id, status, userId);
        return NextResponse.json(updatedTx);
    } catch (error) {
        console.error("Failed to verify transaksi:", error);
        return NextResponse.json(
            { error: "Failed to verify transaksi" },
            { status: 500 }
        );
    }
}
