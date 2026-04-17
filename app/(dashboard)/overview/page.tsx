"use client";

import React, { useState, useEffect } from "react";
import { getDashboardStats, getSystemHealth } from "@/lib/data/dashboard";
import { OverviewClient } from "@/components/dashboard/overview-client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function OverviewPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Client-side session check
    const checkAuth = async () => {
      // In static export, we rely on cookies set by login
      const cookies = document.cookie.split(";").map(c => c.trim());
      const sessionCookie = cookies.find(c => c.startsWith("session="));
      
      if (!sessionCookie) {
        router.push("/login");
        return;
      }
      
      try {
        const token = sessionCookie.split("=")[1];
        const payload = JSON.parse(atob(token.split(".")[1]));
        setSession({ user: payload });
        
        // Fetch stats
        const [statsRes, healthRes] = await Promise.all([
          getDashboardStats(),
          getSystemHealth()
        ]);
        
        // Stats can be direct or wrapped in data
        const statsData = (statsRes as any)?.data || statsRes;
        const healthData = (healthRes as any)?.data || healthRes;

        setStats(statsData);
        setHealth(healthData);
      } catch (error) {
        console.error("Dashboard fetch error:", error);
        // Don't redirect on specific data failure, just show empty
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading || !stats) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <OverviewClient
      stats={stats.spmb}
      moduleStats={stats.moduleStats}
      recentRegistrants={stats.recentRegistrants}
      activePeriod={stats.activePeriod}
      serverHealth={health}
    />
  );
}

