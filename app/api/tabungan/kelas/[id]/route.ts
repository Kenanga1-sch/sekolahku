import { NextRequest, NextResponse } from "next/server";
import { updateKelas, deleteKelas } from "@/lib/tabungan";

// PUT /api/tabungan/kelas/[id]
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params; // Awaiting params for Next.js 15+
        const body = await request.json();
        const updated = await updateKelas(id, body);
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update kelas:", error);
        return NextResponse.json(
            { error: "Failed to update kelas" },
            { status: 500 }
        );
    }
}

// DELETE /api/tabungan/kelas/[id]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params; // Awaiting params for Next.js 15+
        const success = await deleteKelas(id);
        return NextResponse.json({ success });
    } catch (error) {
        console.error("Failed to delete kelas:", error);
        return NextResponse.json(
            { error: "Failed to delete kelas" },
            { status: 500 }
        );
    }
}
