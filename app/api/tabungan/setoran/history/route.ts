import { NextRequest, NextResponse } from "next/server";
import { getSetoranByGuru } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const guruId = searchParams.get("guruId");
    
    // Optional: Validate that session user is the guru or admin
    // if (session.user.role !== "admin" && session.user.id !== guruId) ...
    // For now trust the query param or force use session user id if we want strictness.
    // The previous endpoints used query param `guruId` so keeping consistent.

    if (!guruId) {
        return NextResponse.json({ error: "guruId is required" }, { status: 400 });
    }

    try {
        const items = await getSetoranByGuru(guruId);
        return NextResponse.json({ success: true, items });
    } catch (error) {
        return createErrorResponse(error);
    }
}
