import { NextRequest, NextResponse } from "next/server";
import { bindAsset, getOrCreateCatalog } from "@/lib/library";
import { bindAssetSchema } from "@/lib/validations/library";
import { requireRole } from "@/lib/auth-checks";

export async function POST(request: NextRequest) {
    const auth = await requireRole(["superadmin", "admin", "librarian"]);
    if (!auth.authorized) return auth.response;

    try {
        const body = await request.json();
        const validated = bindAssetSchema.parse(body);

        // 1. Get or Create Catalog
        const catalogData = {
            ...validated.catalog,
            category: validated.catalog.category as any
        };
        const catalog = await getOrCreateCatalog(catalogData);

        // 2. Bind Asset
        const asset = await bindAsset(validated.qrCode, catalog.id, validated.location);

        return NextResponse.json({ success: true, data: asset });
    } catch (error) {
        const err = error as any;
        if (err.name === "ZodError") {
            return NextResponse.json({ success: false, error: "Validation Error", details: err.errors }, { status: 400 });
        }
        if (err.message?.includes("UNIQUE constraint failed")) {
            return NextResponse.json({ success: false, error: "QR Code sudah terdaftar" }, { status: 409 });
        }
        console.error("Bind error", error);
        return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
    }
}
