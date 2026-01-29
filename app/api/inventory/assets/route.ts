import { db } from "@/db";
import { inventoryAssets, inventoryRooms } from "@/db/schema/inventory";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { desc, like, or, eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const ADMIN_ROLES = ["superadmin", "admin"];

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const roomId = searchParams.get("roomId");
    
    // Default filters
    const conditions = [];
    if (q) conditions.push(like(inventoryAssets.name, `%${q}%`));
    if (roomId) conditions.push(eq(inventoryAssets.roomId, roomId));

    const data = await db.query.inventoryAssets.findMany({
      where: and(...conditions),
      with: {
        room: true,
      },
      orderBy: desc(inventoryAssets.createdAt),
    });

    return NextResponse.json({
        items: data,
        totalItems: data.length
    });
  } catch (error) {
    console.error("[INVENTORY_ASSETS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name, code, roomId, quantity, price, conditionGood, category, purchaseDate, notes } = body;

    if (!roomId) {
        return new NextResponse("Room ID Required", { status: 400 });
    }

    // === OWNERSHIP CHECK ===
    const userRole = session.user?.role || "user";
    const isAdmin = ADMIN_ROLES.includes(userRole);

    if (!isAdmin) {
        // Check if user is PIC of the room
        const room = await db.query.inventoryRooms.findFirst({
            where: eq(inventoryRooms.id, roomId),
            columns: { picId: true }
        });

        if (!room) return new NextResponse("Room not found", { status: 404 });

        if (room.picId !== session.user?.id) {
             return new NextResponse("Forbidden: You are not the PIC of this room", { status: 403 });
        }
    }

    const newAsset = await db.insert(inventoryAssets).values({
      id: createId(),
      name,
      code,
      roomId,
      category: category || "OTHER",
      quantity: quantity || 1,
      price: price || 0,
      conditionGood: conditionGood || quantity || 1,
      conditionLightDamaged: 0,
      conditionHeavyDamaged: 0,
      conditionLost: 0,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      notes,
    }).returning();

    return NextResponse.json(newAsset[0]);
  } catch (error) {
    console.error("[INVENTORY_ASSETS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
