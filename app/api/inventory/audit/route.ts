import { db } from "@/db";
import { inventoryAudit } from "@/db/schema/inventory";
import { users } from "@/db/schema/users";
import { desc, eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin", "staff"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const action = searchParams.get("action");
    const entity = searchParams.get("entity");

    const offset = (page - 1) * limit;

    let whereClause = undefined;
    if (action && action !== "all") {
      whereClause = eq(inventoryAudit.action, action);
    }
    if (entity && entity !== "all") {
      const entityClause = eq(inventoryAudit.entity, entity);
      whereClause = whereClause ? and(whereClause, entityClause) : entityClause;
    }

    // Get total count
    const totalResult = await db
      .select({ count: inventoryAudit.id })
      .from(inventoryAudit)
      .where(whereClause);
    const totalItems = totalResult.length;
    const totalPages = Math.ceil(totalItems / limit);

    // Get data with relations
    const data = await db.query.inventoryAudit.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: desc(inventoryAudit.createdAt),
      with: {
        user: true,
      },
    });

    return NextResponse.json({
      items: data.map(item => ({
        id: item.id,
        action: item.action,
        entity: item.entity,
        entity_id: item.entityId,
        changes: item.changes,
        created: item.createdAt,
        expand: {
          user: item.user ? {
            name: item.user.name,
          } : null,
        },
      })),
      totalPages,
      totalItems,
      page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
