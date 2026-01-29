import { db } from "@/db";
import { announcements } from "@/db/schema/misc";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get published news only
    const result = await db
      .select()
      .from(announcements)
      .where(eq(announcements.isPublished, true))
      .orderBy(desc(announcements.publishedAt));

    const items = result.map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      content: a.content,
      category: a.category,
      thumbnail: a.thumbnail,
      excerpt: a.excerpt,
      is_featured: a.isFeatured,
      published_at: a.publishedAt,
      created: a.createdAt,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch news:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
