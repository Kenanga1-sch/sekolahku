import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { spmbRegistrants } from "@/db/schema/spmb";
import { like, eq, and, or, sql } from "drizzle-orm";

// GET /api/spmb/registrants
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "10");
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    try {
        const offset = (page - 1) * perPage;
        const conditions = [];

        if (status !== "all") {
            conditions.push(eq(spmbRegistrants.status, status as any));
        }

        if (search) {
             conditions.push(or(
                like(spmbRegistrants.fullName, `%${search}%`),
                like(spmbRegistrants.registrationNumber, `%${search}%`)
            ));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Count total
        const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(spmbRegistrants)
            .where(whereClause);
        
        const totalItems = countResult.count;
        const totalPages = Math.ceil(totalItems / perPage);

        // Fetch items
        const items = await db
            .select()
            .from(spmbRegistrants)
            .where(whereClause)
            .limit(perPage)
            .offset(offset)
            .orderBy(sql`${spmbRegistrants.createdAt} DESC`);

        return NextResponse.json({
            items,
            page,
            perPage,
            totalItems,
            totalPages,
        });
    } catch (error) {
        console.error("Failed to fetch registrants:", error);
        return NextResponse.json(
            { error: "Failed to fetch registrants" },
            { status: 500 }
        );
    }
}
