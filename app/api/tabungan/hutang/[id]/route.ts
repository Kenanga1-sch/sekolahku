import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateHutang, cancelHutang, payHutangCash } from "@/lib/tabungan";
import { createErrorResponse } from "@/lib/errors";
import { db } from "@/db";
import { tabunganHutang } from "@/db/schema/tabungan";
import { eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const hutang = await db.query.tabunganHutang.findFirst({
            where: eq(tabunganHutang.id, id),
            with: {
                siswa: true,
                pencatat: true,
            },
        });

        if (!hutang) {
            return NextResponse.json({ success: false, error: "Hutang tidak ditemukan" }, { status: 404 });
        }

        return NextResponse.json({ success: true, hutang });
    } catch (error) {
        return createErrorResponse(error);
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { namaBarang, kategori, nominal, jumlah, catatan, tahunAjaran } = body;

        const updated = await updateHutang(id, {
            namaBarang,
            kategori,
            nominal: nominal ? parseInt(nominal) : undefined,
            jumlah: jumlah ? parseInt(jumlah) : undefined,
            catatan,
            tahunAjaran,
        });

        if (!updated) {
            return NextResponse.json(
                { success: false, error: "Hutang tidak ditemukan atau sudah lunas" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, hutang: updated });
    } catch (error) {
        return createErrorResponse(error);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action"); // "cancel" or "pay_cash"

        let result;
        if (action === "pay_cash") {
            result = await payHutangCash(id, session.user.id);
        } else {
            result = await cancelHutang(id, session.user.id);
        }

        if (!result) {
            return NextResponse.json({ success: false, error: "Hutang tidak ditemukan" }, { status: 404 });
        }

        return NextResponse.json({ success: true, hutang: result });
    } catch (error) {
        return createErrorResponse(error);
    }
}
