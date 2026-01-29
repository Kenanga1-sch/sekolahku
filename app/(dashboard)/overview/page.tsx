import { auth } from "@/auth";
import { getDashboardStats, getSystemHealth } from "@/lib/data/dashboard";
import { OverviewClient } from "@/components/dashboard/overview-client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard Overview | Sekolahku",
};

export const revalidate = 0; // Dynamic data

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const [statsData, healthData] = await Promise.all([
    getDashboardStats(session.user.id || ""),
    getSystemHealth()
  ]);

  return (
    <OverviewClient
      stats={statsData.spmb}
      moduleStats={statsData.moduleStats}
      teacherStats={statsData.teacherStats}
      recentRegistrants={statsData.recentRegistrants}
      activePeriod={statsData.activePeriod}
      serverHealth={healthData}
    />
  );
}
