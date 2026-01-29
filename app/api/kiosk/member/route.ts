import { getMemberActiveLoans, hasVisitedToday, recordVisit } from "@/lib/library";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    const type = searchParams.get("type"); // 'loans' or 'visit-status'

    if (!memberId) {
        return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    try {
        if (type === "loans") {
            const loans = await getMemberActiveLoans(memberId);
            return NextResponse.json(loans);
        } else if (type === "visit-status") {
            const visited = await hasVisitedToday(memberId);
            return NextResponse.json({ visited });
        }
    } catch (error) {
        console.error("Member API error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
    
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

export async function POST(req: Request) {
    try {
        const { memberId, type } = await req.json();

        if (type === "record-visit") {
            await recordVisit(memberId);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    } catch (error) {
        console.error("Member API error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
