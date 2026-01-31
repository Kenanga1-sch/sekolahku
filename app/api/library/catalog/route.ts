import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { libraryCatalog } from "@/db/schema/library";
import { sql, eq, or, like } from "drizzle-orm";
import { requireRole } from "@/lib/auth-checks";

export async function GET(request: NextRequest) {
    const auth = await requireRole(["admin", "librarian"]);
    if (!auth.authorized) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q");
    const isbn = searchParams.get("isbn");

    try {
        if (isbn) {
            const result = await db.query.libraryCatalog.findFirst({
                where: eq(libraryCatalog.isbn, isbn)
            });
            return NextResponse.json(result || null);
        }

        if (q) {
            const results = await db.query.libraryCatalog.findMany({
                where: or(
                    like(libraryCatalog.title, `%${q}%`),
                    like(libraryCatalog.author, `%${q}%`),
                    like(libraryCatalog.publisher, `%${q}%`)
                ),
                limit: 10
            });
            return NextResponse.json(results);
        }

        const results = await db.query.libraryCatalog.findMany({
            limit: 50,
            orderBy: [sql`${libraryCatalog.title} ASC`]
        });
        return NextResponse.json(results);
    } catch (error) {
        console.error("Catalog fetch error", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
