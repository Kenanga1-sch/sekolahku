import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSiswaById, updateSiswa, deleteSiswa } from "@/lib/tabungan";

interface Params {
    params: {
        id: string;
    }
}

// GET /api/tabungan/siswa/[id]
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const result = await getSiswaById(params.id);
        if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(result);
    } catch (error) {
        console.error("Failed to fetch siswa:", error);
        return NextResponse.json(
            { error: "Failed to fetch siswa" },
            { status: 500 }
        );
    }
}

// PUT /api/tabungan/siswa/[id]
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (session?.user?.role === "guru") {
            const student = await getSiswaById(params.id);
            if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
            
            // Check if teacher owns the class of this student
            if (student.kelas?.waliKelas !== session.user.id) {
                return NextResponse.json({ error: "Akses ditolak: Siswa ini bukan dari kelas Anda" }, { status: 403 });
            }
        }
        
        const body = await request.json();
        const updated = await updateSiswa(params.id, body);
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update siswa:", error);
        return NextResponse.json(
            { error: "Failed to update siswa" },
            { status: 500 }
        );
    }
}

// DELETE /api/tabungan/siswa/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (session?.user?.role === "guru") {
            const student = await getSiswaById(params.id);
            if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
            
            if (student.kelas?.waliKelas !== session.user.id) {
                 return NextResponse.json({ error: "Akses ditolak: Siswa ini bukan dari kelas Anda" }, { status: 403 });
            }
        }

        await deleteSiswa(params.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete siswa:", error);
        return NextResponse.json(
            { error: "Failed to delete siswa" },
            { status: 500 }
        );
    }
}
