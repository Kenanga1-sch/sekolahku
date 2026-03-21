import { auth } from "@/auth";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["superadmin", "admin"];

// GET Single Room
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    const response = await fetch(`http://localhost:8080/api/inventory/rooms/${id}`, { cache: "no-store" });
    if (!response.ok) {
        if (response.status === 404) return new NextResponse("Room not found", { status: 404 });
        throw new Error("Go API Error");
    }
    
    const room = await response.json();
    return NextResponse.json(room);
  } catch (error) {
    console.error("[INVENTORY_ROOM_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userRole = session.user?.role || "user";
    if (!ADMIN_ROLES.includes(userRole)) {
        return new NextResponse("Forbidden: Admin Access Only", { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const response = await fetch(`http://localhost:8080/api/inventory/rooms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return new NextResponse(errData.error || "Bad Request", { status: response.status });
    }
    
    const updated = await response.json();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[INVENTORY_ROOM_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userRole = session.user?.role || "user";
    if (!ADMIN_ROLES.includes(userRole)) {
        return new NextResponse("Forbidden: Admin Access Only", { status: 403 });
    }

    const { id } = await params;

    const response = await fetch(`http://localhost:8080/api/inventory/rooms/${id}`, {
        method: "DELETE"
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return new NextResponse(errData.error || "Bad Request", { status: response.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[INVENTORY_ROOM_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
