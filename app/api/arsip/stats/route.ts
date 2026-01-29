import { NextResponse } from "next/server";
import { db } from "@/db";
import { suratMasuk, suratKeluar, disposisi } from "@/db/schema/arsip";
import { auth } from "@/auth";
import { sql, eq, and } from "drizzle-orm";

export async function GET() {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const [[countSM], [countSK], [countDisp]] = await Promise.all([
            // Total Surat Masuk This Month
            db.select({ count: sql<number>`count(*)` })
              .from(suratMasuk), // For MVP just total, later filter by month
            
            // Total Surat Keluar This Month
            db.select({ count: sql<number>`count(*)` })
              .from(suratKeluar),

            // Pending Dispositions (My Tasks)
            db.select({ count: sql<number>`count(*)` })
              .from(disposisi)
              .where(and(eq(disposisi.toUserId, session.user.id), eq(disposisi.isCompleted, false)))
        ]);

        return NextResponse.json({
            suratMasuk: countSM.count,
            suratKeluar: countSK.count,
            pendingTasks: countDisp.count,
        });

    } catch (error) {
        console.error("Error fetching stats:", error);
        return NextResponse.json({ 
            suratMasuk: 0, 
            suratKeluar: 0, 
            pendingTasks: 0 
        });
    }
}
