import { db } from "@/db";
import { inventoryItems } from "@/db/schema/inventory";
import { requireRole } from "@/lib/auth-checks";
import { NextResponse } from "next/server";
import { desc, like, or, and, eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const auth = await requireRole(["admin", "staff"]);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    const filters = [];

    if (q) {
      filters.push(
        or(like(inventoryItems.name, `%${q}%`), like(inventoryItems.code, `%${q}%`))
      );
    }

    if (category && category !== "ALL") {
      filters.push(eq(inventoryItems.category, category));
    }

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(inventoryItems)
        .where(and(...filters))
        .orderBy(desc(inventoryItems.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: inventoryItems.id })
        .from(inventoryItems)
        .where(and(...filters)),
    ]);

    const total = countResult.length; // Approximate count logic for Drizzle Lite

    return NextResponse.json({
      data,
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[INVENTORY_ITEMS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(["admin", "staff"]);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { name, code, category, unit, minStock, price, location } = body;

    if (!name) {
      return new NextResponse("Nama barang wajib diisi", { status: 400 });
    }

    const newItem = await db.insert(inventoryItems).values({
      name,
      code,
      category: category || "LAINNYA",
      unit: unit || "Pcs",
      minStock: minStock || 5,
      currentStock: 0, // Initial stock is 0, use In Transaction to add stock
      price: price || 0,
      location,
    }).returning();

    return NextResponse.json(newItem[0]);
  } catch (error) {
    console.error("[INVENTORY_ITEMS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
