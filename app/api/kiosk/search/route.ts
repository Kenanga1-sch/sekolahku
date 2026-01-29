import { auth } from "@/auth";
import { getLibraryItems } from "@/lib/library";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json({ items: [] });
    }

    try {
        const books = await getLibraryItems(1, 10, { search: query });
        return NextResponse.json(books);
    } catch (error) {
        console.error("Search error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
