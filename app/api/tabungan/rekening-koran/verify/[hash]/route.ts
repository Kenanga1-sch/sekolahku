import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tabunganSiswa, tabunganKelas } from "@/db/schema/tabungan";
import { eq } from "drizzle-orm";
import crypto from "crypto";

interface RouteParams {
    params: Promise<{ hash: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { hash } = await params;
        const { searchParams } = new URL(request.url);
        
        // Get verification params
        const siswaId = searchParams.get("s");
        const startDateStr = searchParams.get("sd");
        const endDateStr = searchParams.get("ed");
        const closingBalanceStr = searchParams.get("cb");

        if (!siswaId || !startDateStr || !endDateStr || !closingBalanceStr) {
            return NextResponse.json({
                success: false,
                valid: false,
                message: "Parameter verifikasi tidak lengkap",
            });
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        const closingBalance = parseInt(closingBalanceStr);

        // Recreate hash
        const hashData = `${siswaId}:${startDate.toISOString()}:${endDate.toISOString()}:${closingBalance}:${process.env.AUTH_SECRET || "sekolahku-secret"}`;
        const expectedHash = crypto
            .createHash("sha256")
            .update(hashData)
            .digest("hex")
            .substring(0, 16);

        const isValid = hash === expectedHash;

        if (!isValid) {
            return NextResponse.json({
                success: true,
                valid: false,
                message: "Dokumen tidak dapat diverifikasi. Hash tidak cocok.",
            });
        }

        // Get student info for display
        const [student] = await db
            .select({
                nama: tabunganSiswa.nama,
                nisn: tabunganSiswa.nisn,
                kelas: tabunganKelas.nama,
            })
            .from(tabunganSiswa)
            .leftJoin(tabunganKelas, eq(tabunganSiswa.kelasId, tabunganKelas.id))
            .where(eq(tabunganSiswa.id, siswaId))
            .limit(1);

        return NextResponse.json({
            success: true,
            valid: true,
            message: "✓ Dokumen ini ASLI dan valid.",
            data: {
                student: student || null,
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                },
                closingBalance,
            },
        });
    } catch (error) {
        console.error("Verify statement error:", error);
        return NextResponse.json({
            success: false,
            valid: false,
            message: "Terjadi kesalahan saat verifikasi",
        });
    }
}
