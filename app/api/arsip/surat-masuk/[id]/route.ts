import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suratMasuk, klasifikasiSurat, disposisi } from "@/db/schema/arsip";
import { users } from "@/db/schema/users";
import { eq, desc } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const [mail] = await db
            .select({
                surat: suratMasuk,
                classification: klasifikasiSurat,
            })
            .from(suratMasuk)
            .leftJoin(klasifikasiSurat, eq(suratMasuk.classificationCode, klasifikasiSurat.code))
            .where(eq(suratMasuk.id, params.id))
            .limit(1);

        if (!mail) {
            return NextResponse.json({ error: "Surat tidak ditemukan" }, { status: 404 });
        }

        const dispositions = await db.query.disposisi.findMany({
            where: eq(disposisi.suratMasukId, params.id),
            with: {
                fromUser: {
                    columns: { fullName: true, role: true },
                },
                toUser: {
                    columns: { fullName: true, role: true },
                },
            },
            orderBy: [desc(disposisi.createdAt)],
        });

        return NextResponse.json({
            ...mail.surat,
            classification: mail.classification || null,
            dispositions,
        });

    } catch (error) {
        console.error("Error fetching surat detail:", error);
        return NextResponse.json(
            { error: "Gagal memuat detail surat" },
            { status: 500 }
        );
    }
}
