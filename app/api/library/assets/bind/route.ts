import { NextRequest, NextResponse } from "next/server";
import { bindAsset, getOrCreateCatalog } from "@/lib/library";
import { bindAssetSchema } from "@/lib/validations/library";
import { requireRole } from "@/lib/auth-checks";

export async function POST(request: NextRequest) {
    const auth = await requireRole(["admin", "librarian"]);
    if (!auth.authorized) return auth.response;

    try {
        const body = await request.json();
        const validated = bindAssetSchema.parse(body);

        // 1. Get or Create Catalog
        const catalog = await getOrCreateCatalog(validated.catalog as any);

        // 2. Bind Asset
        const asset = await bindAsset(validated.qrCode, catalog.id, validated.location);

        return NextResponse.json({ success: true, data: asset });
    } catch (error: any) {
        if (error.name === "ZodError") {
            return NextResponse.json({ success: false, error: "Validation Error", details: error.errors }, { status: 400 });
        }
        if (error.message?.includes("UNIQUE constraint failed")) {
            return NextResponse.json({ success: false, error: "QR Code sudah terdaftar" }, { status: 409 });
        }
        console.error("Bind error", error);
        return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
