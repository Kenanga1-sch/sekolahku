import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createHutangBatch } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { siswaIds, namaBarang, kategori, nominal, jumlah, catatan, tahunAjaran } = body;

        if (!siswaIds || !Array.isArray(siswaIds) || siswaIds.length === 0) {
            return NextResponse.json(
                { success: false, error: "Daftar siswa wajib diisi" },
                { status: 400 }
            );
        }

        if (!namaBarang || !nominal) {
            return NextResponse.json(
                { success: false, error: "namaBarang dan nominal wajib diisi" },
                { status: 400 }
            );
        }

        const result = await createHutangBatch({
            siswaIds,
            namaBarang,
            kategori,
            nominal: parseInt(nominal),
            jumlah: jumlah ? parseInt(jumlah) : 1,
            catatan,
            tahunAjaran,
        }, session.user.id);

        return NextResponse.json(result);
    } catch (error) {
        return createErrorResponse(error);
    }
}
