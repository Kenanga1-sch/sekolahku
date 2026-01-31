import { auth } from "@/auth";
import { updateLibraryItem, deleteLibraryItem } from "@/lib/library";
import { NextResponse } from "next/server";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updated = await updateLibraryItem(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update book:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const success = await deleteLibraryItem(id);
    
    if (!success) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to display book:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
