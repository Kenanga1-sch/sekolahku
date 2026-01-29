import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { galleries } from "@/db/schema/gallery";
import { count, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    // Get total count
    const totalResult = await db.select({ count: count() }).from(galleries);
    const total = totalResult[0]?.count || 0;

    // Get counts per category
    const categoryStats = await db
      .select({
        category: galleries.category,
        count: count(),
      })
      .from(galleries)
      .groupBy(galleries.category);

    // Build category map
    const categories: Record<string, number> = {};
    for (const stat of categoryStats) {
      categories[stat.category] = stat.count;
    }

    // Estimate storage (we don't have file size in DB, so this is a placeholder)
    // In a real implementation, you'd store file size in the gallery table
    const estimatedStorageMB = total * 0.5; // Assume avg 500KB per image

    return NextResponse.json({
      total,
      categories,
      storage: {
        used: estimatedStorageMB,
        unit: "MB",
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Gallery stats error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
