import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const queryString = searchParams.toString();
        const targetUrl = `http://localhost:8080/api/master/employees${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(targetUrl, { cache: "no-store" });
        if (!response.ok) throw new Error("Go API Error");
        
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching employees from Go API:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        
        const response = await fetch("http://localhost:8080/api/master/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({ error: data.error || "Bad Request" }, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error creating employee via Go API:", error);
        return NextResponse.json({ error: "Gagal menyimpan data" }, { status: 500 });
    }
}
