
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { schoolSettings } from "@/db/schema/misc";
import { generatedLetters } from "@/db/schema/letters";
import { eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export async function POST(request: NextRequest) {
    const session = await import("@/auth").then(m => m.auth());
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { letterNumber, sequenceNumber, templateId, recipient, classificationCode } = body;

        // 1. Get current settings ID
        const settingsList = await db.select().from(schoolSettings).limit(1);
        const settingsId = settingsList[0].id;

        // 2. Global Counter Update (Only if NO classification code or explicitly requested)
        // If classificationCode is present, we assume it uses Per-Code numbering, so global counter is separate.
        // However, some schools use Global Counter + Classification Code.
        // The prompt asked for "Count by Code". So we don't update Global Counter here.
        if (!classificationCode) {
            await db.update(schoolSettings)
                .set({ 
                    lastLetterNumber: sequenceNumber,
                    updatedAt: new Date()
                })
                .where(eq(schoolSettings.id, settingsId));
        }

        // 3. Log into generated_letters
        await db.insert(generatedLetters).values({
            id: createId(),
            letterNumber,
            sequenceNumber,
            templateId,
            recipient,
            classificationCode: classificationCode || null,
            createdAt: new Date(),
        });
        
        return NextResponse.json({ success: true, newSequence: sequenceNumber });

    } catch (error) {
        console.error("Failed to increment letter number:", error);
        return NextResponse.json(
            { error: "Failed to increment number" },
            { status: 500 }
        );
    }
}
