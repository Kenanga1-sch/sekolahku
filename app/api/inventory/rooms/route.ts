import { auth } from "@/auth";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["superadmin", "admin"];

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    const response = await fetch(`http://localhost:8080/api/inventory/rooms${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Go API Error");
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("[INVENTORY_ROOMS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userRole = session.user?.role || "user";
    if (!ADMIN_ROLES.includes(userRole)) {
        return new NextResponse("Forbidden: Admin Access Only", { status: 403 });
    }

    const body = await req.json();
    
    // proxy to Golang API
    const response = await fetch("http://localhost:8080/api/inventory/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        const errData = await response.json();
        return new NextResponse(errData.error || "Bad Request", { status: response.status });
    }
    
    const newRoom = await response.json();

    return NextResponse.json(newRoom);
  } catch (error) {
    console.error("[INVENTORY_ROOMS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
