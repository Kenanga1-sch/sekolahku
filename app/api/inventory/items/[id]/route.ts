import { db } from "@/db";
import { inventoryItems } from "@/db/schema/inventory";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const item = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.id, id),
      with: {
        transactions: true,
      }
    });

    if (!item) {
      return new NextResponse("Item not found", { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("[INVENTORY_ITEM_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name, code, category, unit, minStock, price, location } = body;

    const updatedItem = await db
      .update(inventoryItems)
      .set({
        name,
        code,
        category,
        unit,
        minStock,
        price,
        location,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .returning();

    return NextResponse.json(updatedItem[0]);
  } catch (error) {
    console.error("[INVENTORY_ITEM_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if item has transactions
    const item = await db.query.inventoryItems.findFirst({
        where: eq(inventoryItems.id, id),
        with: {
            transactions: true
        }
    });

    if (item && item.transactions.length > 0) {
        return new NextResponse("Cannot delete item with existing transactions. Archive it instead.", { status: 400 });
    }

    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[INVENTORY_ITEM_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
