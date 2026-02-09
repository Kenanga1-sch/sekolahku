import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, libraryQrBatches } from "@/db";
import { eq, and, desc, like, lte, gte } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !["superadmin", "admin", "librarian"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const count = body.count || 1;
        const prefix = (body.prefix || "BK").toUpperCase();

        if (count > 100) {
            return NextResponse.json({ error: "Maksimal generate 100 item sekaligus" }, { status: 400 });
        }

        // Generate date code YYYYMMDD
        const now = new Date();
        const dateCode = now.toISOString().slice(0, 10).replace(/-/g, ""); // 20240220
        const dateDb = now.toISOString().slice(0, 10); // 2024-02-20

        // Get latest sequence for this prefix + date
        // Since we store batches, we need to find the max endSequence for this prefix and date
        const lastBatch = await db.query.libraryQrBatches.findFirst({
            where: and(
                eq(libraryQrBatches.prefix, prefix),
                eq(libraryQrBatches.date, dateDb)
            ),
            orderBy: [desc(libraryQrBatches.endSequence)],
        });

        let startSeq = 1;
        if (lastBatch) {
            startSeq = lastBatch.endSequence + 1;
        }

        const codes: string[] = [];
        for (let i = 0; i < count; i++) {
            const seq = (startSeq + i).toString().padStart(4, "0");
            codes.push(`${prefix}-${dateCode}-${seq}`);
        }

        const endSeq = startSeq + count - 1;

        // Save batch record
        await db.insert(libraryQrBatches).values({
            prefix,
            date: dateDb,
            startSequence: startSeq,
            endSequence: endSeq,
            batchSize: count,
            createdBy: session.user.id,
        });

        return NextResponse.json({
            success: true,
            codes,
            startSeq,
            endSeq,
            generatedAt: now.toISOString(),
        });

    } catch (error) {
        console.error("QR Generation failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !["superadmin", "admin", "librarian"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.toUpperCase();
        const dateParam = searchParams.get("date"); // YYYY-MM-DD

        const query = db.select().from(libraryQrBatches);
        const conditions = [];

        if (dateParam) {
            conditions.push(eq(libraryQrBatches.date, dateParam));
        }

        if (search) {
            // Check if search matches code format: PREFIX-YYYYMMDD-XXXX
            // Regex: ([A-Z0-9]+)-(\d{8})-(\d{4})
            const codeMatch = search.match(/^([A-Z0-9]+)-(\d{8})-(\d{4})$/);
            
            if (codeMatch) {
                // Exact code search - extract parts to find the batch
                const [_, pfx, dateStrCompact, seqStr] = codeMatch;
                const formattedDate = `${dateStrCompact.slice(0, 4)}-${dateStrCompact.slice(4, 6)}-${dateStrCompact.slice(6, 8)}`;
                const seq = parseInt(seqStr);

                conditions.push(and(
                    eq(libraryQrBatches.prefix, pfx),
                    eq(libraryQrBatches.date, formattedDate),
                    lte(libraryQrBatches.startSequence, seq),
                    gte(libraryQrBatches.endSequence, seq)
                ));
            } else {
                // Generic search by prefix or date
                // Search by prefix
                conditions.push(like(libraryQrBatches.prefix, `%${search}%`));
            }
        }

        const batches = await query
            .where(and(...conditions))
            .orderBy(desc(libraryQrBatches.createdAt))
            .limit(50); // Increase limit for search results

        return NextResponse.json({
            success: true,
            batches,
        });
    } catch (error) {
        console.error("Fetch history failed:", error);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}
