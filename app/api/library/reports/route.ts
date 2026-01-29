import { requireRole } from "@/lib/auth-checks";
import { getLoanReport, getVisitReport } from "@/lib/library";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(["admin", "librarian"]);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
        return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 });
    }

    if (type === "loan") {
        const data = await getLoanReport(startDate, endDate);
        return NextResponse.json(data);
    } 
    
    if (type === "visit") {
        const data = await getVisitReport(startDate, endDate);
        return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Invalid type parameter. Use 'loan' or 'visit'." }, { status: 400 });

  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
