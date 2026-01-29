import { db } from "@/db";
import { announcements } from "@/db/schema/misc";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    const result = await db
      .select()
      .from(announcements)
      .where(and(
        eq(announcements.slug, slug),
        eq(announcements.isPublished, true)
      ))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const a = result[0];
    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Failed to fetch news:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
