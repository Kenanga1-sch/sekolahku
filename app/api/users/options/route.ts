import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session) return NextResponse.json([], { status: 401 });

        const items = await db
            .select({
                id: users.id,
                name: users.fullName,
                role: users.role,
            })
            .from(users)
            .where(eq(users.isActive, true));

        // Format for dropdown
        const options = items.map(user => ({
            value: user.id,
            label: `${user.name} (${user.role})`
        }));

        return NextResponse.json(options);

    } catch (error) {
        console.error("Error fetching user options:", error);
        return NextResponse.json([], { status: 500 });
    }
}
