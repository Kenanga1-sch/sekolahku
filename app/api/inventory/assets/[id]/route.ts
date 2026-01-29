import { db } from "@/db";
import { inventoryAssets, inventoryRooms } from "@/db/schema/inventory";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

const ADMIN_ROLES = ["superadmin", "admin"];

async function checkAccess(assetId: string, userId: string, userRole: string) {
    if (ADMIN_ROLES.includes(userRole)) return true;

    // Get Asset to find Room
    const asset = await db.query.inventoryAssets.findFirst({
        where: eq(inventoryAssets.id, assetId),
        columns: { roomId: true }
    });

    if (!asset || !asset.roomId) return false;

    // Get Room to find PIC
    const room = await db.query.inventoryRooms.findFirst({
        where: eq(inventoryRooms.id, asset.roomId),
        columns: { picId: true }
    });

    return room?.picId === userId;
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

    const { id } = await params;
    const body = await req.json();

    // === OWNERSHIP CHECK ===
    const canManage = await checkAccess(id, session.user?.id || "", session.user?.role || "");
    if (!canManage) {
        return new NextResponse("Forbidden: You do not have permission to edit this asset", { status: 403 });
    }

    // Exclude fields that shouldn't be updated directly if needed
    const { name, code, roomId, quantity, price, conditionGood, conditionLightDamaged, conditionHeavyDamaged, conditionLost, category, purchaseDate, notes } = body;

    const updated = await db
      .update(inventoryAssets)
      .set({
        name,
        code,
        roomId,
        quantity,
        price,
        category,
        conditionGood, 
        conditionLightDamaged, 
        conditionHeavyDamaged, 
        conditionLost,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(inventoryAssets.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("[INVENTORY_ASSET_PUT]", error);
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

    const { id } = await params;

    // === OWNERSHIP CHECK ===
    const canManage = await checkAccess(id, session.user?.id || "", session.user?.role || "");
    if (!canManage) {
        return new NextResponse("Forbidden: You do not have permission to delete this asset", { status: 403 });
    }

    await db.delete(inventoryAssets).where(eq(inventoryAssets.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[INVENTORY_ASSET_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
