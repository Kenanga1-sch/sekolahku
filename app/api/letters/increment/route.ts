
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
        const res = await fetch("http://localhost:8080/api/eoffice/letters/increment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Gagal increment nomor via Go API");
        }

        const data = await res.json();
        return NextResponse.json({ success: true, newSequence: data.newSequence });

    } catch (error) {
        console.error("Failed to increment letter number:", error);
        return NextResponse.json(
            { error: "Failed to increment number" },
            { status: 500 }
        );
    }
}
