import { getTabunganStats, getTransactionTrend, getSaldoByKelas } from "@/lib/tabungan";
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
      case "trend":
        const trend = await getTransactionTrend();
        return NextResponse.json(trend);
      
      case "saldo-by-kelas":
        const saldo = await getSaldoByKelas();
        return NextResponse.json(saldo);
      
      case "top-savers":
        // Return empty array since function may not exist
        return NextResponse.json([]);
      
      case "recent":
        // Return empty array since function may not exist
        return NextResponse.json([]);
      
      default:
        // Default to stats
        const stats = await getTabunganStats();
        return NextResponse.json(stats);
    }
  } catch (error) {
    console.error("Failed to fetch tabungan data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
