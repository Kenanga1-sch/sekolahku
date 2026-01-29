
import { db } from "@/db";
import { schoolSettings } from "@/db/schema/misc";
import { announcements } from "@/db/schema/misc";
import { spmbPeriods } from "@/db/schema/spmb";
import { students } from "@/db/schema/students";
import { count, desc, eq } from "drizzle-orm";

export async function getHomepageData() {
  try {
    // Fetch school settings
    const settingsResult = await db
      .select()
      .from(schoolSettings)
      .orderBy(desc(schoolSettings.createdAt))
      .limit(1);

    const settings = settingsResult[0] ? {
      school_name: settingsResult[0].schoolName,
      school_address: settingsResult[0].schoolAddress,
      school_phone: settingsResult[0].schoolPhone,
      school_email: settingsResult[0].schoolEmail,
      school_lat: settingsResult[0].schoolLat,
      school_lng: settingsResult[0].schoolLng,
      spmb_is_open: settingsResult[0].spmbIsOpen,
    } : null;

    // Fetch published news (limit 3)
    const newsResult = await db
      .select()
      .from(announcements)
      .where(eq(announcements.isPublished, true))
      .orderBy(desc(announcements.publishedAt))
      .limit(3);

    const news = newsResult.map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: "", 
      content: a.content,
      category: a.category,
      thumbnail: a.thumbnail,
      created: a.createdAt?.toISOString(),
    }));

    // Fetch active SPMB period
    const periodResult = await db.query.spmbPeriods.findFirst({
      where: eq(spmbPeriods.isActive, true),
    });

    const activePeriod = periodResult ? {
      id: periodResult.id,
      name: periodResult.name,
      academic_year: periodResult.academicYear,
      quota: periodResult.quota,
      is_active: periodResult.isActive,
    } : null;

    // Count active students
    const [{ count: studentCount }] = await db
      .select({ count: count() })
      .from(students)
      .where(eq(students.isActive, true));

    return {
      settings,
      news,
      activePeriod,
      stats: {
        studentCount,
      },
    };
  } catch (error) {
    console.error("Failed to fetch homepage data:", error);
    return { settings: null, news: [], activePeriod: null, stats: { studentCount: 0 } };
  }
}
