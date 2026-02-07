import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { libraryVisits, libraryMembers } from "@/db/schema/library";
import { requireAuth } from "@/lib/auth-checks";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();
        if (!auth.authorized) return auth.response;

        const body = await req.json();
        const { memberId, guestName, institution, purpose } = body;

        // Validation
        if (!memberId && !guestName) {
            return NextResponse.json(
                { success: false, error: "Identitas pengunjung (Anggota atau Tamu) wajib diisi" },
                { status: 400 }
            );
        }

        const todayStr = new Date().toISOString().split("T")[0];

        // If Member -> Check for existing visit today to prevent duplicate stats (optional, but good practice)
        if (memberId) {
            const [member] = await db.select().from(libraryMembers).where(eq(libraryMembers.id, memberId)).limit(1);
            if (!member) {
                return NextResponse.json({ success: false, error: "Anggota tidak ditemukan" }, { status: 404 });
            }

            const [existing] = await db.select().from(libraryVisits)
                .where(and(eq(libraryVisits.memberId, memberId), eq(libraryVisits.date, todayStr)))
                .limit(1);
            
            if (existing) {
                return NextResponse.json({ success: true, message: "Kunjungan sudah tercatat hari ini (Anggota)", data: existing });
            }
        }

        // Record Visit
        const [visit] = await db.insert(libraryVisits).values({
            memberId: memberId || null,
            guestName: guestName || null,
            institution: institution || null,
            purpose: purpose || null,
            date: todayStr,
            timestamp: new Date(),
        } as any).returning();

        return NextResponse.json({ success: true, data: visit });

    } catch (error: any) {
        console.error("Manual visit error:", error);
        return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
