import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suratKeluar, klasifikasiSurat } from "@/db/schema/arsip";
import { users } from "@/db/schema/users";
import { eq, like, and, desc, sql } from "drizzle-orm";
import { auth } from "@/auth";

// Helper: Convert Month to Roman
function getRomanMonth(date: Date): string {
    const months = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return months[date.getMonth()];
}

// Helper: Generate Mail Number
// Format: [ClassCode]/[XXX]-SD/[RomanMonth]/[Year]
async function generateMailNumber(classCode: string, date: Date) {
    const year = date.getFullYear();
    const romanMonth = getRomanMonth(date);
    
    // Count existing letters for this year
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // We need to extract the number part to increment correctly.
    // However, for simplicity/MVP, we can count total records for the year and +1.
    // A better approach for production: Store a sequence table or parse max number.
    // Let's rely on count for now.
    
    const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(suratKeluar)
        .where(
            and(
                sql`${suratKeluar.dateOfLetter} >= ${startOfYear.toISOString().split('T')[0]}`,
                sql`${suratKeluar.dateOfLetter} <= ${endOfYear.toISOString().split('T')[0]}`
            )
        );

    const nextNum = (result.count || 0) + 1;
    const paddedNum = nextNum.toString().padStart(3, "0");
    
    return `${classCode}/${paddedNum}-SD/${romanMonth}/${year}`;
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            recipient,
            subject,
            dateOfLetter, // YYYY-MM-DD
            classificationCode,
        } = body;

        if (!recipient || !subject || !dateOfLetter || !classificationCode) {
            return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
        }

        const date = new Date(dateOfLetter);
        
        // Generate Number
        const mailNumber = await generateMailNumber(classificationCode, date);

        // Save Draft
        const [newSurat] = await db.insert(suratKeluar).values({
            mailNumber,
            recipient,
            subject,
            dateOfLetter,
            classificationCode,
            status: "Draft",
            createdBy: session.user.id,
        }).returning();

        return NextResponse.json(newSurat, { status: 201 });

    } catch (error) {
        console.error("Error creating surat keluar:", error);
        return NextResponse.json(
            { error: "Gagal membuat surat keluar" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");

    try {
        const offset = (page - 1) * perPage;
        
        const conditions = [];
        
        if (search) {
            const s = `%${search}%`;
            conditions.push(sql`(${suratKeluar.subject} LIKE ${s} OR ${suratKeluar.recipient} LIKE ${s} OR ${suratKeluar.mailNumber} LIKE ${s})`);
        }

        if (status && status !== "all") {
            conditions.push(eq(suratKeluar.status, status as any));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Count total
        const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(suratKeluar)
            .where(whereClause);
            
        const totalItems = countResult.count;
        const totalPages = Math.ceil(totalItems / perPage);

        // Get data
        const items = await db
            .select({
                surat: suratKeluar,
                classification: klasifikasiSurat,
                creator: users,
            })
            .from(suratKeluar)
            .leftJoin(klasifikasiSurat, eq(suratKeluar.classificationCode, klasifikasiSurat.code))
            .leftJoin(users, eq(suratKeluar.createdBy, users.id))
            .where(whereClause)
            .limit(perPage)
            .offset(offset)
            .orderBy(desc(suratKeluar.createdAt));
            
        const flattenedItems = items.map(({ surat, classification, creator }) => ({
            ...surat,
            classification: classification || null,
            creator: creator ? { name: creator.fullName } : null,
        }));

        return NextResponse.json({
            items: flattenedItems,
            totalItems,
            totalPages,
            page,
            perPage
        });

    } catch (error) {
        console.error("Error fetching surat keluar:", error);
        return NextResponse.json(
            { error: "Gagal memuat surat keluar" },
            { status: 500 }
        );
    }
}
