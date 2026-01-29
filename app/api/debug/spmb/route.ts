import { NextResponse } from "next/server";
import { db } from "@/db";
import { spmbPeriods } from "@/db/schema/spmb";
import { schoolSettings } from "@/db/schema/misc";
import { eq } from "drizzle-orm";

export async function GET() {
    try {
        const activePeriods = await db.select().from(spmbPeriods).where(eq(spmbPeriods.isActive, true));
        const settings = await db.select().from(schoolSettings).limit(1);
        const now = new Date();

        return NextResponse.json({
            now: now.toISOString(),
            activePeriods,
            settings: settings[0] || null,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
