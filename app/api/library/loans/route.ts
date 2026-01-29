import { requireRole } from "@/lib/auth-checks";
import { getActiveLoans, getOverdueLoans, getMemberActiveLoans } from "@/lib/library";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(["admin", "librarian"]);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const memberId = searchParams.get("memberId");

    if (type === "active") {
        if (memberId) {
            const data = await getMemberActiveLoans(memberId);
            return NextResponse.json(data);
        }
        const data = await getActiveLoans();
        return NextResponse.json(data);
    } 
    
    if (type === "overdue") {
        const data = await getOverdueLoans();
        return NextResponse.json(data);
    }

    // Default: both? Or just error.
    return NextResponse.json({ error: "Invalid type parameter. Use 'active' or 'overdue'." }, { status: 400 });

  } catch (error) {
    console.error("Failed to fetch loans:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
