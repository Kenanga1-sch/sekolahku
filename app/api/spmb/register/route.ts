import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = [
      "student_name",
      "student_nik",
      "birth_date",
      "birth_place",
      "gender",
      "parent_name",
      "parent_phone",
      "parent_email",
      "address",
      "home_lat",
      "home_lng",
      "distance_to_school",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Field ${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate NIK format (16 digits)
    if (!/^\d{16}$/.test(body.student_nik)) {
      return NextResponse.json(
        { success: false, error: "NIK harus 16 digit angka" },
        { status: 400 }
      );
    }

    // Check if NIK already registered
    try {
      const existing = await pb.collection("spmb_registrants").getFirstListItem(
        `student_nik = "${body.student_nik}"`
      );
      if (existing) {
        return NextResponse.json(
          { success: false, error: "NIK sudah terdaftar sebelumnya" },
          { status: 400 }
        );
      }
    } catch {
      // Not found is expected, continue
    }

    // Get active SPMB period
    let activePeriod;
    try {
      activePeriod = await pb.collection("spmb_periods").getFirstListItem(
        "is_active = true"
      );
    } catch {
      return NextResponse.json(
        { success: false, error: "Tidak ada periode SPMB aktif saat ini" },
        { status: 400 }
      );
    }

    // Generate registration number
    const year = new Date().getFullYear();
    const count = await pb.collection("spmb_registrants").getList(1, 1, {
      filter: `created >= "${year}-01-01"`,
    });
    const sequence = (count.totalItems + 1).toString().padStart(4, "0");
    const registrationNumber = `SPMB${year}${sequence}`;

    // Determine zone status based on distance
    const maxDistance = 3; // km - should be fetched from school_settings
    const isInZone = body.distance_to_school <= maxDistance;

    // Create registrant record
    const registrant = await pb.collection("spmb_registrants").create({
      period_id: activePeriod.id,
      registration_number: registrationNumber,
      student_name: body.student_name,
      student_nik: body.student_nik,
      birth_date: body.birth_date,
      birth_place: body.birth_place,
      gender: body.gender,
      previous_school: body.previous_school || "",
      parent_name: body.parent_name,
      parent_phone: body.parent_phone,
      parent_email: body.parent_email,
      address: body.address,
      home_lat: body.home_lat,
      home_lng: body.home_lng,
      distance_to_school: body.distance_to_school,
      is_in_zone: isInZone,
      status: "pending",
    });

    return NextResponse.json({
      success: true,
      data: {
        registration_number: registrationNumber,
        id: registrant.id,
        status: "pending",
        is_in_zone: isInZone,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mendaftar. Silakan coba lagi." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let filter = "";
    const filters: string[] = [];

    if (status && status !== "all") {
      filters.push(`status = "${status}"`);
    }

    if (search) {
      filters.push(`(student_name ~ "${search}" || registration_number ~ "${search}")`);
    }

    if (filters.length > 0) {
      filter = filters.join(" && ");
    }

    const registrants = await pb.collection("spmb_registrants").getList(page, limit, {
      filter,
      sort: "-created",
      expand: "period_id",
    });

    return NextResponse.json({
      success: true,
      data: registrants.items,
      pagination: {
        page: registrants.page,
        perPage: registrants.perPage,
        totalItems: registrants.totalItems,
        totalPages: registrants.totalPages,
      },
    });
  } catch (error) {
    console.error("Fetch registrants error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data pendaftar" },
      { status: 500 }
    );
  }
}
