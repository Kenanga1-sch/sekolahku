
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generatedLetters } from "@/db/schema/letters";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { startOfMonth, endOfMonth } from "date-fns";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { classificationCode, date } = body; // date is ISO string

        if (!classificationCode) {
            return NextResponse.json({ nextSequence: 1 });
        }

        const res = await fetch("http://localhost:8080/api/eoffice/letters/numbering", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Gagal mengkalkulasi nomor via Go API");
        }

        const data = await res.json();
        return NextResponse.json({ nextSequence: data.nextSequence });

    } catch (error) {
        console.error("Failed to calculate number:", error);
        return NextResponse.json({ error: "Calculation failed" }, { status: 500 });
    }
}
