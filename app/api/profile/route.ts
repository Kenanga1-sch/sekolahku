import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  oldPassword: z.string().min(1),
  password: z.string().min(8),
  passwordConfirm: z.string().min(8),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Password baru tidak cocok",
  path: ["passwordConfirm"],
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Check if password update
    if (body.password) {
      const { oldPassword, password } = await passwordSchema.parseAsync(body);
      
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });

      if (!user || !user.passwordHash) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const match = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!match) {
        return NextResponse.json({ error: "Password lama salah" }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await db.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, session.user.id));
      
      return NextResponse.json({ success: true });
    }

    // Profile update
    const { name, phone } = await profileSchema.parseAsync(body);
    await db.update(users).set({ fullName: name, phone }).where(eq(users.id, session.user.id));
    // Note: session.user.name might not update until re-login or session update
    
    return NextResponse.json({ success: true });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
