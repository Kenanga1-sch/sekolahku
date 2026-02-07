import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStudentStatement } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const siswaId = searchParams.get("siswaId");
        const startDateStr = searchParams.get("startDate");
        const endDateStr = searchParams.get("endDate");

        if (!siswaId || !startDateStr || !endDateStr) {
            return NextResponse.json(
                { success: false, error: "siswaId, startDate, dan endDate wajib diisi" },
                { status: 400 }
            );
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return NextResponse.json(
                { success: false, error: "Format tanggal tidak valid" },
                { status: 400 }
            );
        }

        if (startDate > endDate) {
            return NextResponse.json(
                { success: false, error: "Tanggal mulai tidak boleh setelah tanggal akhir" },
                { status: 400 }
            );
        }

        const statement = await getStudentStatement(siswaId, startDate, endDate);

        if (!statement) {
            return NextResponse.json(
                { success: false, error: "Siswa tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: statement });
    } catch (error) {
        return createErrorResponse(error);
    }
}
