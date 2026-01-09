import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090");

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const registrationNumber = searchParams.get("number");

    if (!registrationNumber) {
      return NextResponse.json(
        { success: false, error: "Nomor pendaftaran harus diisi" },
        { status: 400 }
      );
    }

    // Validate format (SPMB + year + sequence)
    if (!/^SPMB\d{8}$/.test(registrationNumber)) {
      return NextResponse.json(
        { success: false, error: "Format nomor pendaftaran tidak valid" },
        { status: 400 }
      );
    }

    try {
      const registrant = await pb.collection("spmb_registrants").getFirstListItem(
        `registration_number = "${registrationNumber}"`,
        { expand: "period_id" }
      );

      // Map status to Indonesian
      const statusMap: Record<string, string> = {
        pending: "Menunggu Verifikasi",
        verified: "Terverifikasi",
        accepted: "Diterima",
        rejected: "Ditolak",
      };

      return NextResponse.json({
        success: true,
        data: {
          registration_number: registrant.registration_number,
          student_name: registrant.student_name,
          status: registrant.status,
          status_label: statusMap[registrant.status] || registrant.status,
          is_in_zone: registrant.is_in_zone,
          distance_to_school: registrant.distance_to_school,
          registered_at: registrant.created,
          period_name: registrant.expand?.period_id?.name || "Unknown Period",
          notes: registrant.notes || null,
        },
      });
    } catch {
      return NextResponse.json(
        { success: false, error: "Nomor pendaftaran tidak ditemukan" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengecek status" },
      { status: 500 }
    );
  }
}
