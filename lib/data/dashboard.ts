
import { db } from "@/db";
import { spmbRegistrants, spmbPeriods } from "@/db/schema/spmb";
import { libraryItems, libraryLoans, libraryMembers } from "@/db/schema/library";
import { inventoryAssets, inventoryRooms } from "@/db/schema/inventory";
import { tabunganSiswa, tabunganTransaksi } from "@/db/schema/tabungan";
import { teacherTp, teachingModules, studentGrades, classJournals } from "@/db/schema/curriculum";
import { eq, sql, and, lt, gte, or } from "drizzle-orm";
import { statSync, existsSync } from "fs";
import { join } from "path";
import os from "os";
import { unstable_cache } from "next/cache";
import type { SystemHealth } from "@/types";

// Cached stats fetcher
const getCachedStats = unstable_cache(
  async () => {
    // SPMB Stats
    const spmbStats = {
      total: 0,
      pending: 0,
      verified: 0,
      accepted: 0,
      rejected: 0,
    };

    try {
      const [total, pending, verified, accepted, rejected] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(spmbRegistrants),
        db.select({ count: sql<number>`count(*)` }).from(spmbRegistrants).where(eq(spmbRegistrants.status, 'pending')),
        db.select({ count: sql<number>`count(*)` }).from(spmbRegistrants).where(eq(spmbRegistrants.status, 'verified')),
        db.select({ count: sql<number>`count(*)` }).from(spmbRegistrants).where(eq(spmbRegistrants.status, 'accepted')),
        db.select({ count: sql<number>`count(*)` }).from(spmbRegistrants).where(eq(spmbRegistrants.status, 'rejected')),
      ]);
      spmbStats.total = total[0]?.count || 0;
      spmbStats.pending = pending[0]?.count || 0;
      spmbStats.verified = verified[0]?.count || 0;
      spmbStats.accepted = accepted[0]?.count || 0;
      spmbStats.rejected = rejected[0]?.count || 0;
    } catch {}

    // Active Period
    let activePeriod = null;
    try {
      activePeriod = await db.query.spmbPeriods.findFirst({
        where: eq(spmbPeriods.isActive, true),
      });
    } catch {}

    // Recent Registrants
    let recentRegistrants: any[] = [];
    try {
      recentRegistrants = await db
        .select({
          id: spmbRegistrants.id,
          studentName: spmbRegistrants.studentName,
          registrationNumber: spmbRegistrants.registrationNumber,
          status: spmbRegistrants.status,
          createdAt: spmbRegistrants.createdAt,
        })
        .from(spmbRegistrants)
        .orderBy(sql`${spmbRegistrants.createdAt} DESC`)
        .limit(5);
    } catch {}

    // Library Stats
    const perpustakaan = {
      totalBooks: 0,
      activeLoans: 0,
      overdueLoans: 0,
      totalMembers: 0,
    };
    try {
      const today = new Date().toISOString().split("T")[0];
      const [books, loans, overdue, members] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(libraryItems),
        db.select({ count: sql<number>`count(*)` }).from(libraryLoans).where(eq(libraryLoans.isReturned, false)),
        db.select({ count: sql<number>`count(*)` }).from(libraryLoans).where(and(eq(libraryLoans.isReturned, false), lt(libraryLoans.dueDate, new Date(today)))),
        db.select({ count: sql<number>`count(*)` }).from(libraryMembers),
      ]);
      perpustakaan.totalBooks = books[0]?.count || 0;
      perpustakaan.activeLoans = loans[0]?.count || 0;
      perpustakaan.overdueLoans = overdue[0]?.count || 0;
      perpustakaan.totalMembers = members[0]?.count || 0;
    } catch {}

    // Inventory Stats
    const inventaris = {
      totalAssets: 0,
      needsMaintenance: 0,
      totalRooms: 0,
    };
    try {
      const [assets, rooms, maintenance] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(inventoryAssets),
        db.select({ count: sql<number>`count(*)` }).from(inventoryRooms),
        db.select({ count: sql<number>`count(*)` }).from(inventoryAssets).where(
          or(
            sql`${inventoryAssets.conditionLightDamaged} > 0`,
            sql`${inventoryAssets.conditionHeavyDamaged} > 0`
          )
        )
      ]);
      inventaris.totalAssets = assets[0]?.count || 0;
      inventaris.totalRooms = rooms[0]?.count || 0;
      inventaris.needsMaintenance = maintenance[0]?.count || 0;
    } catch {}

    // Tabungan Stats
    const tabungan = {
      totalSaldo: 0,
      todayTransactions: 0,
      totalStudents: 0,
    };
    try {
      const today = new Date().toISOString().split("T")[0];
      const [students, transactions] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(tabunganSiswa),
        db.select({ count: sql<number>`count(*)` }).from(tabunganTransaksi).where(gte(tabunganTransaksi.createdAt, new Date(today))),
      ]);
      tabungan.totalStudents = students[0]?.count || 0;
      tabungan.todayTransactions = transactions[0]?.count || 0;

      // Calculate total saldo
      const saldoResult = await db.select({ total: sql<number>`sum(${tabunganSiswa.saldoTerakhir})` }).from(tabunganSiswa);
      tabungan.totalSaldo = saldoResult[0]?.total || 0;
    } catch {}

    return {
      spmb: spmbStats,
      activePeriod,
      recentRegistrants: recentRegistrants.map(r => ({
        id: r.id,
        student_name: r.studentName,
        registration_number: r.registrationNumber,
        status: r.status,
        created: r.createdAt?.toISOString(),
      })),
      moduleStats: {
        perpustakaan,
        inventaris,
        tabungan,
      },
    };
  },
  ["dashboard-stats"], // Cache key
  { revalidate: 60 } // Revalidate every 60 seconds
);

export async function getDashboardStats(userId: string) {
  try {
    const cachedData = await getCachedStats();
    
    // Teacher stats are user-specific, so we don't cache them globally with the main dashboard stats
    // We could cache them per-user if needed, but for now we fetch fresh
    const teacherStats = await getTeacherStats(userId);

    return {
      ...cachedData,
      teacherStats,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    // Return empty stats structure on error
    return {
      spmb: { total: 0, pending: 0, verified: 0, accepted: 0, rejected: 0 },
      activePeriod: null,
      recentRegistrants: [],
      moduleStats: {
          perpustakaan: { totalBooks: 0, activeLoans: 0, overdueLoans: 0, totalMembers: 0 },
          inventaris: { totalAssets: 0, needsMaintenance: 0, totalRooms: 0 },
          tabungan: { totalSaldo: 0, todayTransactions: 0, totalStudents: 0 }
      },
      teacherStats: { tpCount: 0, moduleCount: 0, gradeCount: 0, journalCount: 0 }
    };
  }
}

export async function getSystemHealth(): Promise<SystemHealth | null> {
  try {
    const dbPath = join(process.cwd(), "data", "sekolahku.db");
    
    // Database Stats
    let dbSize = 0;
    let dbStatus: "Online" | "Offline" = "Unknown" as any;
    
    if (existsSync(dbPath)) {
      const stats = statSync(dbPath);
      dbSize = stats.size;
      dbStatus = "Online";
    } else {
      dbStatus = "Offline";
    }

    // Server Stats
    const memoryUsage = process.memoryUsage();
    
    const uptime = os.uptime();

    // Check Backup Status
    const backupDir = join(process.cwd(), "backups");
    let lastBackup = null;
    let backupCount = 0;
    
    if (existsSync(backupDir)) {
      const { readdirSync } = require("fs");
      const files = readdirSync(backupDir).filter((f: string) => f.endsWith(".gz"));
      backupCount = files.length;
      if (files.length > 0) {
          // Sort to find latest
          files.sort().reverse();
          const latestFile = files[0];
          const stats = statSync(join(backupDir, latestFile));
          lastBackup = stats.mtime;
      }
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        size_bytes: dbSize,
        formatted_size: (dbSize / 1024 / 1024).toFixed(2) + " MB",
      },
      system: {
        uptime_seconds: uptime,
        memory_usage_mb: (memoryUsage.rss / 1024 / 1024).toFixed(2),
      },
      backup: {
        count: backupCount,
        last_backup: lastBackup,
      }
    };

  } catch (error) {
    return null;
  }
}

async function getTeacherStats(userId: string) {
  try {
    const [tp, mod, grades, journals] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(teacherTp).where(eq(teacherTp.teacherId, userId)),
      db.select({ count: sql<number>`count(*)` }).from(teachingModules)
        .leftJoin(teacherTp, eq(teachingModules.tpId, teacherTp.id))
        .where(eq(teacherTp.teacherId, userId)),
      db.select({ count: sql<number>`count(*)` }).from(studentGrades)
        .leftJoin(teacherTp, eq(studentGrades.tpId, teacherTp.id))
        .where(eq(teacherTp.teacherId, userId)),
       db.select({ count: sql<number>`count(*)` }).from(classJournals).where(eq(classJournals.teacherId, userId)) 
    ]);

    return {
      tpCount: tp[0]?.count || 0,
      moduleCount: mod[0]?.count || 0,
      gradeCount: grades[0]?.count || 0,
      journalCount: journals[0]?.count || 0
    };
  } catch (e) {
    return { tpCount: 0, moduleCount: 0, gradeCount: 0, journalCount: 0 };
  }
}
