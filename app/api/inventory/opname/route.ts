import { db } from "@/db";
import { inventoryOpname, inventoryRooms } from "@/db/schema/inventory";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const ADMIN_ROLES = ["superadmin", "admin"];

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Only Admin can view Opname History? 
    // Spec says: "Menu: Stok Opname - Hidden / Access Denied" for non-admin.
    const userRole = session.user?.role || "user";
    if (!ADMIN_ROLES.includes(userRole)) {
        return new NextResponse("Forbidden: Admin Access Only", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const data = await db.query.inventoryOpname.findMany({
      limit: limit,
      with: {
        room: true,
        auditor: {
            columns: {
                name: true,
                email: true
            }
        }
      },
      orderBy: desc(inventoryOpname.created),
    });

    return NextResponse.json({
        items: data,
        totalItems: data.length 
    });
  } catch (error) {
    console.error("[INVENTORY_OPNAME_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userRole = session.user?.role || "user";
    if (!ADMIN_ROLES.includes(userRole)) {
        return new NextResponse("Forbidden: Admin Access Only", { status: 403 });
    }

    const body = await req.json();
    const { date, items, note } = body;

    // TODO: Validate items array if needed

    const newOpname = await db.insert(inventoryOpname).values({
      id: createId(),
      date: date ? new Date(date) : new Date(),
      roomId: body.roomId,
      auditorId: body.auditorId || session.user?.id,
      items: items, // JSON
      status: "PENDING",
      note: note,
    }).returning();

    return NextResponse.json(newOpname[0]);
  } catch (error) {
    console.error("[INVENTORY_OPNAME_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
