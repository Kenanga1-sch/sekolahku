import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStudentFinalReport } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const siswaId = searchParams.get("siswaId");

        if (!siswaId) {
            return NextResponse.json(
                { success: false, error: "siswaId wajib diisi" },
                { status: 400 }
            );
        }

        const report = await getStudentFinalReport(siswaId);

        return NextResponse.json({ success: true, report });
    } catch (error) {
        return createErrorResponse(error);
    }
}
