import { getRecentActivity, getLoanTrend, getCategoryDistribution, getTopBorrowedBooks, getTopActiveMembers } from "@/lib/library";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    switch (type) {
      case "recent-activity":
        const activity = await getRecentActivity(10);
        return NextResponse.json(activity);
      
      case "loan-trend":
        const trend = await getLoanTrend(7);
        return NextResponse.json(trend);
      
      case "category-distribution":
        const categories = await getCategoryDistribution();
        return NextResponse.json(categories);
      
      case "top-books":
        const books = await getTopBorrowedBooks(5);
        return NextResponse.json(books);
      
      case "top-members":
        const members = await getTopActiveMembers(5);
        return NextResponse.json(members);
      
      default:
        return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }
  } catch (error) {
    console.error("Failed to fetch library data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
