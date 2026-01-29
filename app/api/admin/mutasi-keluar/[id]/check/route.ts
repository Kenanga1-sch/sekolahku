import { NextResponse } from "next/server";
import { db, mutasiOutRequests, libraryMembers, libraryLoans, tabunganSiswa, students } from "@/db";
import { auth } from "@/auth";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // 1. Get Request Info
    const mutasiRequest = await db.query.mutasiOutRequests.findFirst({
      where: eq(mutasiOutRequests.id, id),
    });

    if (!mutasiRequest) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 });
    }

    const studentId = mutasiRequest.studentId;

    // 2. Check Library Loans
    // First find library member id
    const libMember = await db.query.libraryMembers.findFirst({
      where: eq(libraryMembers.studentId, studentId),
    });

    let activeLoansCount = 0;
    if (libMember) {
      const activeLoans = await db
        .select()
        .from(libraryLoans)
        .where(
            and(
                eq(libraryLoans.memberId, libMember.id),
                eq(libraryLoans.isReturned, false)
            )
        );
      activeLoansCount = activeLoans.length;
    }

    // 3. Check Tabungan Balance
    const tabungan = await db.query.tabunganSiswa.findFirst({
      where: eq(tabunganSiswa.studentId, studentId),
    });

    const balance = tabungan ? tabungan.saldoTerakhir : 0;

    return NextResponse.json({
      success: true,
      data: {
        library: {
            hasMember: !!libMember,
            activeLoans: activeLoansCount,
            status: activeLoansCount === 0 ? "Clear" : "Tanggungan Buku"
        },
        financial: {
            hasAccount: !!tabungan,
            balance: balance,
            status: balance > 0 ? "Saldo Tersisa" : "Clear"
        }
      }
    });

  } catch (error) {
    console.error("Check error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
