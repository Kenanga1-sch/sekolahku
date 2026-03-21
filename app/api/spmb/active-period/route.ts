import { NextResponse } from "next/server";

/**
 * Public API to get the currently active SPMB period
 * No authentication required
 */
export async function GET() {
    try {
        const response = await fetch("http://localhost:8080/api/spmb/active-period", { cache: 'no-store' });
        if (!response.ok) throw new Error("API Error");
        const data = await response.json();
        
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching active period:", error);
        return NextResponse.json(
            { success: false, error: "Gagal mengambil data periode aktif" },
            { status: 500 }
        );
    }
}
