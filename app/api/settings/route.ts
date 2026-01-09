import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090");

export async function GET() {
  try {
    // Try to get school settings, return defaults if not found
    try {
      const settings = await pb.collection("school_settings").getFirstListItem("");
      
      return NextResponse.json({
        success: true,
        data: {
          school_name: settings.school_name,
          npsn: settings.npsn,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          school_lat: settings.school_lat,
          school_lng: settings.school_lng,
          max_distance: settings.max_distance,
        },
      });
    } catch {
      // Return defaults if settings not found
      return NextResponse.json({
        success: true,
        data: {
          school_name: "SD Negeri 1",
          npsn: "12345678",
          address: "Jl. Pendidikan No. 123, Jakarta",
          phone: "(021) 1234-5678",
          email: "info@sdnegeri1.sch.id",
          school_lat: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LAT || "-6.200000"),
          school_lng: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LNG || "106.816666"),
          max_distance: 3,
        },
      });
    }
  } catch (error) {
    console.error("Fetch settings error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil pengaturan sekolah" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Get existing settings or create new
    let settingsId: string | null = null;
    try {
      const existing = await pb.collection("school_settings").getFirstListItem("");
      settingsId = existing.id;
    } catch {
      // Will create new
    }

    const settingsData = {
      school_name: body.school_name,
      npsn: body.npsn,
      address: body.address,
      phone: body.phone,
      email: body.email,
      school_lat: body.school_lat,
      school_lng: body.school_lng,
      max_distance: body.max_distance,
    };

    let result;
    if (settingsId) {
      result = await pb.collection("school_settings").update(settingsId, settingsData);
    } else {
      result = await pb.collection("school_settings").create(settingsData);
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan pengaturan" },
      { status: 500 }
    );
  }
}
