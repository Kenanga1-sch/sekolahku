import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const response = await fetch("http://localhost:8080/api/spmb/periods", { cache: 'no-store' });
        if (!response.ok) throw new Error("API Error");
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching periods:", error);
        return NextResponse.json(
            { success: false, error: "Gagal mengambil data periode" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        const response = await fetch("http://localhost:8080/api/spmb/periods", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error("API Error");
        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error creating period:", error);
        return NextResponse.json(
            { success: false, error: "Gagal membuat periode" },
            { status: 500 }
        );
    }
}
