import { db } from "@/db";
import { inventoryRooms } from "@/db/schema/inventory";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { desc, like, or } from "drizzle-orm";
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
    // const page = parseInt(searchParams.get("page") || "1");
    // const limit = parseInt(searchParams.get("limit") || "50");

    const filters = [];
    if (q) {
      filters.push(like(inventoryRooms.name, `%${q}%`));
    }

    const data = await db.query.inventoryRooms.findMany({
      where: q ? like(inventoryRooms.name, `%${q}%`) : undefined,
      with: {
        pic: {
            columns: {
                name: true,
                email: true,
            }
        }
      },
      orderBy: desc(inventoryRooms.createdAt),
    });

    return NextResponse.json({
        items: data,
        totalItems: data.length 
    });
  } catch (error) {
    console.error("[INVENTORY_ROOMS_GET]", error);
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
    const { name, location, description, code, picId } = body;
    
    if (!name) {
      return new NextResponse("Nama ruangan wajib diisi", { status: 400 });
    }

    const newRoom = await db.insert(inventoryRooms).values({
      id: createId(),
      name,
      code,
      description,
      location,
      picId: picId || null,
    }).returning();

    return NextResponse.json(newRoom[0]);
  } catch (error) {
    console.error("[INVENTORY_ROOMS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
