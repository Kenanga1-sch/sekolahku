import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    
    // Forward the exact search params to the Go backend
    const queryString = searchParams.toString();
    const targetUrl = `http://localhost:8080/api/students${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(targetUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Go API Error");
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch students from Go API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
