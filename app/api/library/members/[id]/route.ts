import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateLibraryMember, deleteLibraryMember } from "@/lib/library";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    
    // Auth check
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;

    try {
        const body = await request.json();
        const member = await updateLibraryMember(id, body);
        return NextResponse.json(member);
    } catch (error) {
        console.error("Update member error:", error);
        return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    
    // Auth check
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const success = await deleteLibraryMember(id);
        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
        }
    } catch (error) {
        console.error("Delete member error:", error);
        return NextResponse.json({ error: "Error deleting member" }, { status: 500 });
    }
}
