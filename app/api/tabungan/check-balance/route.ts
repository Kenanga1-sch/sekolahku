import { NextResponse } from "next/server";
import { db, tabunganSiswa, students } from "@/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic"; // Ensure no caching

const checkSchema = z.object({
  identifier: z.string().min(1, "Identifier required"), // NISN or QR Code content
  birthDate: z.string().optional(), // Required only for manual input fallback
});

// Simple in-memory rate limiter (Note: In production with multiple replicas, use Redis)
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 10;
const requestLog: Record<string, number[]> = {};

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = requestLog[ip] || [];
  
  // Filter out old requests
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS) {
    return false;
  }
  
  recentRequests.push(now);
  requestLog[ip] = recentRequests;
  return true;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { message: "Terlalu banyak permintaan. Silakan coba lagi nanti." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validation = checkSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Data tidak valid" },
        { status: 400 }
      );
    }

    const { identifier, birthDate } = validation.data;

    // Search Strategy:
    // 1. Try to find by NISN directly (Manual Input usually sends NISN + DOB)
    // 2. Try to find by QR Code (Scanner sends raw code)
    
    let studentId: string | null = null;
    let foundStudent = null;

    // Check if it looks like a NISN (numeric, 10 digits) and we have birthDate (Manual mode)
    if (/^\d{10}$/.test(identifier) && birthDate) {
       foundStudent = await db.query.students.findFirst({
         where: and(
           eq(students.nisn, identifier),
           eq(students.birthDate, birthDate),
           eq(students.isActive, true)
         )
       });
    } else {
       // Assume it's a QR Code scan (could be NISN or internal ID or QR field)
       // First try QR field
       foundStudent = await db.query.students.findFirst({
         where: and(eq(students.qrCode, identifier), eq(students.isActive, true))
       });
       
       // Fallback: search by NISN if QR didn't match
       if (!foundStudent) {
         foundStudent = await db.query.students.findFirst({
            where: and(eq(students.nisn, identifier), eq(students.isActive, true))
          });
       }
    }

    if (!foundStudent) {
      return NextResponse.json(
        { message: "Data siswa tidak ditemukan." },
        { status: 404 }
      );
    }

    // Fetch Tabungan Balance
    const tabungan = await db.query.tabunganSiswa.findFirst({
        where: eq(tabunganSiswa.studentId, foundStudent.id),
        with: {
            kelas: true
        }
    });

    if (!tabungan) {
         return NextResponse.json(
        { message: "Rekening tabungan belum aktif." },
        { status: 404 }
      );
    }

    // Mask name for privacy
    // Example: "Budi Santoso" -> "Budi S******"
    const nameParts = foundStudent.fullName.split(" ");
    const firstName = nameParts[0];
    const maskedLastName = nameParts.length > 1 ? nameParts[1][0] + "******" : "******";
    const maskedName = `${firstName} ${maskedLastName}`;

    return NextResponse.json({
      success: true,
      data: {
        name: maskedName,
        className: tabungan.kelas?.nama || foundStudent.className || "-",
        balance: tabungan.saldoTerakhir,
        lastUpdate: tabungan.updatedAt,
      }
    });

  } catch (error) {
    console.error("Check balance error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
