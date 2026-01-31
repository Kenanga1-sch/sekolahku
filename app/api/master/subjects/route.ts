
import { NextResponse } from "next/server";
import { db, subjects } from "@/db";
import { auth } from "@/auth";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await db.select().from(subjects).orderBy(subjects.code);
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "Error fetching data" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        
        const [subject] = await db.insert(subjects).values({
            name: body.name,
            code: body.code,
            description: body.description,
        }).returning();

        return NextResponse.json(subject);

    } catch (error: any) {
        console.error(error);
        if (error.message?.includes("UNIQUE constraint")) {
             return NextResponse.json({ error: "Kode Mapel sudah ada" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
    }
}
