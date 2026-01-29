import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs, AuditAction, AuditResource } from "@/lib/audit";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "superadmin"].includes(session.user.role || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "20");
    const actionParam = searchParams.get("action");
    const resourceParam = searchParams.get("resource");

    const result = await getAuditLogs({
      page,
      perPage,
      action: actionParam && actionParam !== "all" ? (actionParam as AuditAction) : undefined,
      resource: resourceParam && resourceParam !== "all" ? (resourceParam as AuditResource) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Audit log API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
