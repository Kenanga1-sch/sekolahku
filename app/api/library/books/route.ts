import { requireAuth, requireRole } from "@/lib/auth-checks";
import { getLibraryItems, createLibraryItem } from "@/lib/library";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "20");

    const result = await getLibraryItems(page, perPage, { search, category });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch library items:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["admin", "librarian"]);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const newItem = await createLibraryItem(body);
    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Failed to create library item:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
