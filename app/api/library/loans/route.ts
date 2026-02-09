import { requireRole } from "@/lib/auth-checks";
import { getActiveLoans, getOverdueLoans, getMemberActiveLoans } from "@/lib/library";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(["superadmin", "admin", "librarian"]);
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

export async function POST(request: Request) {
    try {
        const auth = await requireRole(["superadmin", "admin", "librarian"]);
        if (!auth.authorized) return auth.response;

        const body = await request.json();
        
        // Validate
        const parseResult = await import("@/lib/validations/library").then(m => m.createLoanSchema.safeParseAsync(body));
        if (!parseResult.success) {
            return NextResponse.json({ error: "Validation Error", details: parseResult.error.flatten().fieldErrors }, { status: 400 });
        }

        const { memberId, itemId, loanDays } = parseResult.data;
        const loan = await import("@/lib/library").then(m => m.borrowBook(memberId, itemId, loanDays));
        
        return NextResponse.json({ success: true, data: loan });
    } catch (error: any) {
        console.error("Create loan error:", error);
        return NextResponse.json({ error: error.message || "Failed to create loan" }, { status: 500 });
    }
}
