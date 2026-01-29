import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { spmbPeriods, spmbRegistrants } from "@/db/schema/spmb";
import { eq, and, or, sql } from "drizzle-orm";
import {
  rankRegistrants,
  processAcceptance,
  getAgeReferenceDate,
  type RankedRegistrant,
} from "@/lib/spmb-priority";
import type { SPMBRegistrant } from "@/db/schema/spmb";

/**
 * POST /api/spmb/process
 * 
 * Process acceptance based on quota and priority rules.
 * This will calculate rankings and update registrant statuses.
 * 
 * Body: {
 *   periodId: string;      // Required: SPMB period to process
 *   dryRun?: boolean;      // Optional: If true, only calculate rankings without updating
 *   customQuota?: number;  // Optional: Override period quota
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { periodId, dryRun = false, customQuota } = body;

    if (!periodId) {
      return NextResponse.json(
        { success: false, error: "Period ID diperlukan" },
        { status: 400 }
      );
    }

    // Get period details
    const [period] = await db.select().from(spmbPeriods).where(eq(spmbPeriods.id, periodId)).limit(1);

    if (!period) {
      return NextResponse.json(
        { success: false, error: "Periode SPMB tidak ditemukan" },
        { status: 404 }
      );
    }

    const quota = customQuota ?? period.quota ?? 100;

    // Get all registrants for this period with status 'pending' or 'verified'
    const registrantsResult = await db.select()
        .from(spmbRegistrants)
        .where(and(
            eq(spmbRegistrants.periodId, periodId),
            or(eq(spmbRegistrants.status, "pending"), eq(spmbRegistrants.status, "verified"))
        ));

    if (registrantsResult.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada pendaftar yang perlu diproses",
        totalProcessed: 0,
        accepted: 0,
        rejected: 0,
        waitlist: 0,
        rankings: [],
      });
    }

    // Get reference date for age calculation (July 1st of academic year)
    const referenceDate = getAgeReferenceDate(period.academicYear);

    // Process acceptance
    const result = processAcceptance(registrantsResult as SPMBRegistrant[], quota, referenceDate);

    // If not dry run, update registrant statuses in database
    if (!dryRun) {
      const updatePromises = result.rankings.map(async (ranked: RankedRegistrant) => {
        const newStatus = ranked.recommendation === "accepted" ? "accepted" : 
                          ranked.recommendation === "rejected" ? "rejected" : 
                          "verified"; // waitlist stays as verified

        return db.update(spmbRegistrants).set({
          status: newStatus,
          priorityRank: ranked.priorityRank,
          priorityGroup: ranked.agePriority.group,
          notes: ranked.recommendation === "waitlist" 
            ? `Daftar tunggu - Urutan ke-${ranked.priorityRank}` // Drizzle uses strict types, notes allows string | null
            : ranked.notes
        }).where(eq(spmbRegistrants.id, ranked.id));
      });

      await Promise.all(updatePromises);
    }

    // Prepare response with summary
    const summary = {
      success: true,
      dryRun,
      periodName: period.name,
      academicYear: period.academicYear,
      quota,
      totalRegistrants: registrantsResult.length,
      totalProcessed: result.totalProcessed,
      accepted: result.accepted,
      rejected: result.rejected,
      waitlist: result.waitlist,
      referenceDate: referenceDate.toISOString(),
      rankings: result.rankings.map((r: RankedRegistrant) => ({
        id: r.id,
        rank: r.priorityRank,
        name: r.fullName,
        birthDate: r.birthDate.toISOString(), // Date object
        age: `${r.agePriority.years}y ${r.agePriority.months}m`,
        priorityGroup: r.agePriority.group,
        distance: r.distanceToSchool,
        registeredAt: r.createdAt?.toISOString(),
        recommendation: r.recommendation,
      })),
    };

    return NextResponse.json(summary);

  } catch (error) {
    console.error("Process acceptance error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memproses penerimaan" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/spmb/process?periodId=xxx
 * 
 * Get current rankings without processing (dry run)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("periodId");

    if (!periodId) {
      return NextResponse.json(
        { success: false, error: "Period ID diperlukan" },
        { status: 400 }
      );
    }

    // Get period details
    const [period] = await db.select().from(spmbPeriods).where(eq(spmbPeriods.id, periodId)).limit(1);

    if (!period) {
      return NextResponse.json(
        { success: false, error: "Periode SPMB tidak ditemukan" },
        { status: 404 }
      );
    }

    // Get all registrants for this period
    const registrantsResult = await db.select()
        .from(spmbRegistrants)
        .where(eq(spmbRegistrants.periodId, periodId)); // Fetches all regardless of status for GET?? 
        // Original code filtered by `period_id = ...`. It didn't filter by status pending/verified?
        // Original code: `filter: period_id = ...` (line 161). Correct.

    // Get reference date
    const referenceDate = getAgeReferenceDate(period.academicYear);

    // Calculate rankings (without processing)
    const ranked = rankRegistrants(registrantsResult as SPMBRegistrant[], referenceDate);

    return NextResponse.json({
      success: true,
      periodName: period.name,
      academicYear: period.academicYear,
      quota: period.quota,
      totalRegistrants: registrantsResult.length,
      referenceDate: referenceDate.toISOString(),
      rankings: ranked.map((r: RankedRegistrant) => ({
        id: r.id,
        rank: r.priorityRank,
        name: r.fullName,
        birthDate: r.birthDate.toISOString(),
        age: `${r.agePriority.years}y ${r.agePriority.months}m`,
        priorityGroup: r.agePriority.group,
        priorityGroupLabel: r.agePriority.group === 1 ? "7-12 tahun" :
                            r.agePriority.group === 2 ? "6 tahun" : "<6 tahun",
        distance: r.distanceToSchool,
        isInZone: r.isInZone,
        registeredAt: r.createdAt?.toISOString(),
        currentStatus: r.status,
      })),
    });

  } catch (error) {
    console.error("Get rankings error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil peringkat" },
      { status: 500 }
    );
  }
}
