import { db } from "@/db";
import { spmbRegistrants } from "@/db/schema/spmb";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const registrationNumber = searchParams.get("registration_number");

    if (!registrationNumber) {
      return NextResponse.json({ error: "Registration number required" }, { status: 400 });
    }

    const result = await db.query.spmbRegistrants.findFirst({
      where: eq(spmbRegistrants.registrationNumber, registrationNumber),
    });

    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Return data in compatible format
    return NextResponse.json({
      id: result.id,
      student_name: result.studentName,
      registration_number: result.registrationNumber,
      status: result.status,
      birth_place: result.birthPlace,
      birth_date: result.birthDate,
      gender: result.gender,
      parent_name: result.parentName,
      parent_phone: result.parentPhone,
      address: result.address,
      home_lat: result.homeLat,
      home_lng: result.homeLng,
      distance_to_school: result.distanceToSchool,
      created: result.createdAt,
      student_nik: result.studentNik,
      full_name: result.fullName,
      notes: result.notes,
      is_in_zone: result.isInZone,
      verified_at: result.verifiedAt,
    });
  } catch (error) {
    console.error("Failed to fetch registrant:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
