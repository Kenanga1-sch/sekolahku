import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { checkRateLimit, sanitizeString, sanitizeEmail, sanitizePhone, sanitizeNIK } from "@/lib/security";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090");

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 10 registrations per IP per hour
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const rateCheck = checkRateLimit(`register:${clientIp}`, {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Sanitize inputs
    const sanitizedData = {
      ...body,
      student_name: sanitizeString(body.student_name || ""),
      student_nik: sanitizeNIK(body.student_nik || ""),
      birth_place: sanitizeString(body.birth_place || ""),
      parent_name: sanitizeString(body.parent_name || ""),
      parent_phone: sanitizePhone(body.parent_phone || ""),
      parent_email: sanitizeEmail(body.parent_email || ""),
      address: sanitizeString(body.address || ""),
      previous_school: sanitizeString(body.previous_school || ""),
    };
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
      student_name: sanitizedData.student_name,
      student_nik: sanitizedData.student_nik,
      birth_date: body.birth_date,
      birth_place: sanitizedData.birth_place,
      gender: body.gender,
      previous_school: sanitizedData.previous_school,
      parent_name: sanitizedData.parent_name,
      parent_phone: sanitizedData.parent_phone,
      parent_email: sanitizedData.parent_email,
      address: sanitizedData.address,
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
