import { NextRequest, NextResponse } from "next/server";
import { getSiswa, createSiswa, getSiswaByQr, getSiswaByStudentQRCode } from "@/lib/tabungan";

// GET /api/tabungan/siswa
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const qrCode = searchParams.get("qrCode");
    const studentQrCode = searchParams.get("studentQrCode");

    // Support student QR code lookup
    if (studentQrCode) {
        try {
            const siswa = await getSiswaByStudentQRCode(studentQrCode);
            if (!siswa) {
                return NextResponse.json({
                    items: [],
                    totalItems: 0,
                    totalPages: 0,
                    page: 1,
                    perPage: 1,
                    message: "Siswa belum terdaftar di tabungan"
                });
            }
            return NextResponse.json({
                items: [siswa],
                totalItems: 1,
                totalPages: 1,
                page: 1,
                perPage: 1
            });
        } catch (error) {
            console.error("Failed to fetch siswa by student QR:", error);
            return NextResponse.json({ error: "Failed to fetch siswa" }, { status: 500 });
        }
    }

    // Support tabungan QR code lookup (legacy)
    if (qrCode) {
        try {
            // First try tabungan QR code
            let siswa = await getSiswaByQr(qrCode);
            
            // If not found, try as student QR code
            if (!siswa) {
                siswa = await getSiswaByStudentQRCode(qrCode);
            }
            
            if (!siswa) {
                return NextResponse.json({
                    items: [],
                    totalItems: 0,
                    totalPages: 0,
                    page: 1,
                    perPage: 1
                });
            }
            return NextResponse.json({
                items: [siswa],
                totalItems: 1,
                totalPages: 1,
                page: 1,
                perPage: 1
            });
        } catch (error) {
            console.error("Failed to fetch siswa by QR:", error);
            return NextResponse.json({ error: "Failed to fetch siswa" }, { status: 500 });
        }
    }

    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "20");
    const search = searchParams.get("search") || undefined;
    const kelasId = searchParams.get("kelasId") || undefined;

    try {
        const result = await getSiswa(page, perPage, { search, kelasId });
        // Map lib result to expected API response (PaginatedResult)
        return NextResponse.json({
            items: result.items,
            page,
            perPage,
            totalItems: result.totalItems,
            totalPages: result.totalPages,
        });
    } catch (error) {
        console.error("Failed to fetch siswa:", error);
        return NextResponse.json(
            { error: "Failed to fetch siswa" },
            { status: 500 }
        );
    }
}

// POST /api/tabungan/siswa
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const newSiswa = await createSiswa(body);
        return NextResponse.json(newSiswa);
    } catch (error) {
        console.error("Failed to create siswa:", error);
        return NextResponse.json(
            { error: "Failed to create siswa" },
            { status: 500 }
        );
    }
}
