import { db } from "@/db";
import { announcements } from "@/db/schema/misc";
import { desc, like, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { randomUUID } from "crypto";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    
    let result;
    if (search) {
      result = await db
        .select()
        .from(announcements)
        .where(or(
          like(announcements.title, `%${search}%`),
          like(announcements.content, `%${search}%`)
        ))
        .orderBy(desc(announcements.createdAt));
    } else {
      result = await db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.createdAt));
    }

    // Map to camelCase for frontend compatibility
    const items = result.map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      content: a.content,
      category: a.category,
      thumbnail: a.thumbnail,
      is_published: a.isPublished,
      is_featured: false, // Add if needed
      published_at: a.publishedAt,
      excerpt: a.excerpt,
      created: a.createdAt,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin", "staff"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = randomUUID();

    await db.insert(announcements).values({
      id,
      title: body.title,
      slug: body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      excerpt: body.excerpt,
      content: body.content,
      category: body.category || "pengumuman",
      thumbnail: body.thumbnail,
      isPublished: body.is_published || false,
      publishedAt: body.is_published ? new Date() : null,
      authorId: session.user.id,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Failed to create announcement:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
