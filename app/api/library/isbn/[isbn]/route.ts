import { NextRequest, NextResponse } from "next/server";
import { lookupISBN } from "@/lib/library";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ isbn: string }> }
) {
    try {
        const { isbn } = await context.params;
        const data = await lookupISBN(isbn);

        if (!data) {
            return NextResponse.json({ success: false, error: "Buku tidak ditemukan" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
