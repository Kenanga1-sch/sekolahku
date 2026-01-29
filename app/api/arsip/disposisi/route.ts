import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { disposisi, suratMasuk } from "@/db/schema/arsip";
import { users } from "@/db/schema/users";
import { eq, and, desc, asc } from "drizzle-orm";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            suratMasukId,
            toUserId,
            instruction,
            deadline,
        } = body;

        if (!suratMasukId || !toUserId || !instruction) {
            return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
        }

        const [newDisposisi] = await db.insert(disposisi).values({
            suratMasukId,
            fromUserId: session.user.id,
            toUserId,
            instruction,
            deadline: deadline || null,
            isCompleted: false,
        }).returning();

        // Optionally update suratMasuk status to "Terdisposisi"
        await db.update(suratMasuk)
            .set({ status: "Terdisposisi", updatedAt: new Date() })
            .where(eq(suratMasuk.id, suratMasukId));

        return NextResponse.json(newDisposisi, { status: 201 });

    } catch (error) {
        console.error("Error creating disposisi:", error);
        return NextResponse.json(
            { error: "Gagal membuat disposisi" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const suratId = searchParams.get("suratMasukId");
    const userId = searchParams.get("userId"); // Filter by assignee (My Tasks)

    try {
        const conditions = [];

        if (suratId) conditions.push(eq(disposisi.suratMasukId, suratId));
        if (userId) conditions.push(eq(disposisi.toUserId, userId));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const items = await db
            .select({
                disposisi: disposisi,
                fromUser: users,
                toUser: users, // We need to alias if creating generic query, but here handled by order
            })
            // Join specific columns manually to avoid collision if possible, or alias logic is needed but drizzle handles simple joins well usually.
            // Drizzle returns separate objects.
            .from(disposisi)
            .leftJoin(users, eq(disposisi.fromUserId, users.id))
            // We can't join users twice without alias in raw SQL easily, but Drizzle object syntax handles it via separate calls or aliasedTable.
            // Let's assume simpler query: Get ToUser via separate join or just fetch details.
            // Actually, for "My Tasks", knowing "From" is important.
            // For "Surat Detail", knowing "To" is important.
            // Let's implement generic logic with manual simple join for one side, or use relations capability if we used `db.query`.
            // But we are using `db.select`.
            // Let's use `aliasedTable`.
            .where(whereClause)
            .orderBy(desc(disposisi.createdAt));

        // To properly fetch "toUser", let's use a simpler approach or `db.query` if available.
        // `db.query.disposisi.findMany` is cleaner for relations.
        // Let's switch to Query Builder (Relational) which is better for this.
        
        const relationalItems = await db.query.disposisi.findMany({
            where: (table, { eq, and }) => {
                const criteria = [];
                if (suratId) criteria.push(eq(table.suratMasukId, suratId));
                if (userId) criteria.push(eq(table.toUserId, userId));
                return criteria.length ? and(...criteria) : undefined;
            },
            with: {
                fromUser: {
                    columns: { id: true, fullName: true, email: true },
                },
                toUser: {
                    columns: { id: true, fullName: true, email: true },
                },
                suratMasuk: true, // Include mail details for "My Tasks" view
            },
            orderBy: (table, { desc }) => [desc(table.createdAt)],
        });

        return NextResponse.json(relationalItems);

    } catch (error) {
        console.error("Error fetching disposisi:", error);
        return NextResponse.json(
            { error: "Gagal memuat disposisi" },
            { status: 500 }
        );
    }
}
