import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suratMasuk, klasifikasiSurat } from "@/db/schema/arsip";
import { users } from "@/db/schema/users";
import { eq, like, and, desc, asc, sql } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/auth";

// Helper to generate Agenda Number: AGD/YYYY/XXX
async function generateAgendaNumber(date: Date) {
    const year = date.getFullYear();
    
    // Count existing letters for this year
    // Note: This is a simple count. For strict concurrency, use a separate counter table or atomic increments.
    // For this app scale, count is acceptable.
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(suratMasuk)
        .where(
            and(
                sql`${suratMasuk.receivedAt} >= ${startOfYear.getTime()}`,
                sql`${suratMasuk.receivedAt} <= ${endOfYear.getTime()}`
            )
        );

    const nextNum = (result.count || 0) + 1;
    const paddedNum = nextNum.toString().padStart(3, "0");
    
    return `AGD/${year}/${paddedNum}`;
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const originalNumber = formData.get("originalNumber") as string;
        const sender = formData.get("sender") as string;
        const subject = formData.get("subject") as string;
        const dateOfLetter = formData.get("dateOfLetter") as string; // YYYY-MM-DD
        const receivedAtStr = formData.get("receivedAt") as string; // YYYY-MM-DD
        const classificationCode = formData.get("classificationCode") as string | null;
        const notes = formData.get("notes") as string | null;

        if (!file || !originalNumber || !sender || !subject || !dateOfLetter || !receivedAtStr) {
            return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
        }

        // 1. Handle File Upload
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split(".").pop();
        const filename = `SM-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        
        // Ensure directory exists
        const uploadDir = join(process.cwd(), "public/uploads/arsip/surat-masuk");
        await mkdir(uploadDir, { recursive: true });
        
        const filePath = join(uploadDir, filename);
        await writeFile(filePath, buffer);
        
        const publicPath = `/uploads/arsip/surat-masuk/${filename}`;

        // 2. Generate Agenda Number
        const receivedAt = new Date(receivedAtStr);
        const agendaNumber = await generateAgendaNumber(receivedAt);

        // 3. Save to DB
        const [newSurat] = await db.insert(suratMasuk).values({
            agendaNumber,
            originalNumber,
            sender,
            subject,
            dateOfLetter,
            receivedAt,
            classificationCode: classificationCode || null,
            filePath: publicPath,
            notes: notes || null,
            status: "Menunggu Disposisi",
        }).returning();

        return NextResponse.json(newSurat, { status: 201 });

    } catch (error) {
        console.error("Error creating surat masuk:", error);
        return NextResponse.json(
            { error: "Gagal menyimpan surat masuk" },
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
            conditions.push(sql`(${suratMasuk.subject} LIKE ${s} OR ${suratMasuk.sender} LIKE ${s} OR ${suratMasuk.agendaNumber} LIKE ${s})`);
        }

        if (status && status !== "all") {
            conditions.push(eq(suratMasuk.status, status as any));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Count total
        const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(suratMasuk)
            .where(whereClause);
            
        const totalItems = countResult.count;
        const totalPages = Math.ceil(totalItems / perPage);

        // Get data
        const items = await db
            .select({
                surat: suratMasuk,
                classification: klasifikasiSurat,
            })
            .from(suratMasuk)
            .leftJoin(klasifikasiSurat, eq(suratMasuk.classificationCode, klasifikasiSurat.code))
            .where(whereClause)
            .limit(perPage)
            .offset(offset)
            .orderBy(desc(suratMasuk.receivedAt));
            
        // Map to flat structure if needed, or keep nested
        const flattenedItems = items.map(({ surat, classification }) => ({
            ...surat,
            classification: classification || null,
        }));

        return NextResponse.json({
            items: flattenedItems,
            totalItems,
            totalPages,
            page,
            perPage
        });

    } catch (error) {
        console.error("Error fetching surat masuk:", error);
        return NextResponse.json(
            { error: "Gagal memuat surat masuk" },
            { status: 500 }
        );
    }
}
