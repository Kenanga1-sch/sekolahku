import { db } from "@/db";
import { inventoryOpname, inventoryAssets, inventoryAudit } from "@/db/schema/inventory";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const ADMIN_ROLES = ["superadmin", "admin"];

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> } // Fix for Next.js 15+ dynamic params
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

    const opname = await db.query.inventoryOpname.findFirst({
        where: eq(inventoryOpname.id, id)
    });

    if (!opname) {
        return new NextResponse("Opname session not found", { status: 404 });
    }

    if (opname.status === "APPLIED") {
        return new NextResponse("Opname already applied", { status: 400 });
    }

    // Apply Logic: Update assets based on physical count
    const items = opname.items as any[];
    
    await db.transaction(async (tx) => {
        // 1. Update Assets
        for (const item of items) {
            // Logic: You might want to update only if there's a discrepancy or update the "condition" breakdown
            // Assuming Opname provides the new truth for conditions
            await tx.update(inventoryAssets)
                .set({
                    quantity: (item.qtyGood || 0) + (item.qtyLightDamage || 0) + (item.qtyHeavyDamage || 0), // Exclude Lost from total available? Or keep it? Usually Lost is separate.
                    // Let's assume total quantity = Good + Damaged. Lost is removed from stock.
                    // Or follow existing schema logic. 
                    conditionGood: item.qtyGood,
                    conditionLightDamaged: item.qtyLightDamage,
                    conditionHeavyDamaged: item.qtyHeavyDamage,
                    conditionLost: item.qtyLost,
                    updatedAt: new Date(),
                })
                .where(eq(inventoryAssets.id, item.assetId));
        }

        // 2. Update Opname Status
        await tx.update(inventoryOpname)
            .set({ status: "APPLIED" })
            .where(eq(inventoryOpname.id, id));

        // 3. Log Audit
        await tx.insert(inventoryAudit).values({
            id: createId(),
            action: "OPNAME_APPLY",
            entity: "OPNAME",
            entityId: id,
            userId: session.user?.id,
            changes: { summary: "Opname values applied to inventory assets" },
            createdAt: new Date(),
        });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[INVENTORY_OPNAME_APPLY]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
