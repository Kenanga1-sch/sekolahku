import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { settleHutangFromTabungan } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { siswaId, catatan } = body;

        if (!siswaId) {
            return NextResponse.json(
                { success: false, error: "siswaId wajib diisi" },
                { status: 400 }
            );
        }

        const result = await settleHutangFromTabungan(siswaId, session.user.id, catatan);

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return createErrorResponse(error);
    }
}
