import { auth } from "@/auth";
import { returnBook } from "@/lib/library";
import { NextResponse } from "next/server";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // const { id } = params; // Redundant extraction removed
    
    // In Next 15+ or latest 14, params might be a promise or direct. Drizzle adapter usually doesn't affect this.
    // Assuming standard App Router behavior.
    
    const updatedLoan = await returnBook(id);
    return NextResponse.json(updatedLoan);

  } catch (error) {
    console.error("Failed to return book:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
