import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq, like, or, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { auth } from "@/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    // Build where clause
    const conditions = search
      ? or(
          like(users.email, `%${search}%`),
          like(users.name, `%${search}%`)
        )
      : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(conditions);
    const total = countResult[0]?.count || 0;

    // Get users
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(conditions)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      items: result,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      page,
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { email, password, name, phone, role } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Check if email exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = randomUUID();

    await db.insert(users).values({
      id,
      email,
      passwordHash: hashedPassword,
      name: name || email.split("@")[0],
      phone,
      role: role || "user",
      emailVerified: null,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
