import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { galleries } from "@/db/schema/gallery";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get("category");

    let query = db.select().from(galleries).orderBy(desc(galleries.createdAt));

    if (category && category !== "all") {
      // @ts-ignore - dyanmic query in drizzle needs proper type handling or just simple if
       // Actually for sqlite-core simple where clause works
       const records = await db.select().from(galleries).where(eq(galleries.category, category)).orderBy(desc(galleries.createdAt));
       return NextResponse.json({ data: records });
    }

    const records = await query;
    return NextResponse.json({ data: records });

  } catch (error) {
    console.error("Gallery list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
