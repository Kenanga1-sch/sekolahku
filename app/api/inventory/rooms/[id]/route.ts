import { db } from "@/db";
import { inventoryRooms } from "@/db/schema/inventory";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

const ADMIN_ROLES = ["superadmin", "admin"];

// GET Single Room
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    const room = await db.query.inventoryRooms.findFirst({
        where: eq(inventoryRooms.id, id),
        with: {
            pic: {
                columns: {
                    name: true,
                    email: true,
                }
            }
        }
    });

    if (!room) {
        return new NextResponse("Room not found", { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error("[INVENTORY_ROOM_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userRole = session.user?.role || "user";
    if (!ADMIN_ROLES.includes(userRole)) {
        return new NextResponse("Forbidden: Admin Access Only", { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, location, description, code, picId } = body;

    const updated = await db
      .update(inventoryRooms)
      .set({
        name,
        code,
        description,
        location,
        picId,
      })
      .where(eq(inventoryRooms.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("[INVENTORY_ROOM_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userRole = session.user?.role || "user";
    if (!ADMIN_ROLES.includes(userRole)) {
        return new NextResponse("Forbidden: Admin Access Only", { status: 403 });
    }

    const { id } = await params;

    await db.delete(inventoryRooms).where(eq(inventoryRooms.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[INVENTORY_ROOM_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
