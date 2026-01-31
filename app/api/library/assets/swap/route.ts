import { NextRequest, NextResponse } from "next/server";
import { swapAssetCode } from "@/lib/library";
import { requireRole } from "@/lib/auth-checks";
import { z } from "zod";

const swapSchema = z.object({
    oldQr: z.string().min(1),
    newQr: z.string().min(1)
});

export async function POST(request: NextRequest) {
    const auth = await requireRole(["admin", "librarian"]);
    if (!auth.authorized) return auth.response;

    try {
        const body = await request.json();
        const { oldQr, newQr } = swapSchema.parse(body);

        const asset = await swapAssetCode(oldQr, newQr);

        return NextResponse.json({ success: true, data: asset });
    } catch (error: any) {
        console.error("Swap error", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Internal Server Error"
        }, { status: 500 });
    }
}
