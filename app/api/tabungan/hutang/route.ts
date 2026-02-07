import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createHutang, getHutangList } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") as any;
        const kelasId = searchParams.get("kelasId") || undefined;
        const tahunAjaran = searchParams.get("tahunAjaran") || undefined;
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "20");

        const items = await getHutangList({ status, kelasId, tahunAjaran, page, perPage });
        return NextResponse.json({ success: true, items });
    } catch (error) {
        return createErrorResponse(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { siswaId, namaBarang, kategori, nominal, jumlah, tanggalAmbil, catatan, tahunAjaran } = body;

        if (!siswaId || !namaBarang || !nominal) {
            return NextResponse.json(
                { success: false, error: "siswaId, namaBarang, dan nominal wajib diisi" },
                { status: 400 }
            );
        }

        const hutang = await createHutang({
            siswaId,
            namaBarang,
            kategori,
            nominal: parseInt(nominal),
            jumlah: jumlah ? parseInt(jumlah) : 1,
            tanggalAmbil: tanggalAmbil ? new Date(tanggalAmbil) : new Date(),
            catatan,
            tahunAjaran,
        }, session.user.id);

        return NextResponse.json({ success: true, hutang });
    } catch (error) {
        return createErrorResponse(error);
    }
}
