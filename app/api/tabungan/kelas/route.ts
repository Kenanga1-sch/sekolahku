import { NextRequest, NextResponse } from "next/server";
import { getAllKelas, createKelas } from "@/lib/tabungan";

// GET /api/tabungan/kelas
export async function GET(request: NextRequest) {
    try {
        const kelas = await getAllKelas();
        return NextResponse.json(kelas);
    } catch (error) {
        console.error("Failed to fetch kelas:", error);
        return NextResponse.json(
            { error: "Failed to fetch kelas" },
            { status: 500 }
        );
    }
}

// POST /api/tabungan/kelas
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // Validation logic here?
        const newKelas = await createKelas(body);
        return NextResponse.json(newKelas);
    } catch (error) {
        console.error("Failed to create kelas:", error);
        return NextResponse.json(
            { error: "Failed to create kelas" },
            { status: 500 }
        );
    }
}
