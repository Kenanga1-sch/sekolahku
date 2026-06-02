"use client";

import React, { useState, useEffect } from "react";
import { getDashboardStats, getSystemHealth } from "@/lib/data/dashboard";
import { OverviewClient } from "@/components/dashboard/overview-client";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OverviewPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Client-side session check
    const checkAuth = async () => {
      // In static export, we rely on cookies set by login
      const cookies = document.cookie.split(";").map(c => c.trim());
      const infoCookie = cookies.find(c => c.startsWith("user_info="));
      
      if (!infoCookie) {
        console.warn("No user_info cookie found, redirecting to login");
        router.push("/login?redirect=/overview");
        return;
      }
      
      try {
        setError(null);
        const value = infoCookie.split("=")[1];
        const jsonValue = decodeURIComponent(value.replace(/\+/g, " "));
        const userData = JSON.parse(jsonValue);
        setSession({ user: userData });
        
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
      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError(err.message || "Gagal memuat data Beranda");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading || !stats) {
    if (!isLoading && error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="space-y-4 p-6 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
              <div>
                <h1 className="text-lg font-semibold">Beranda belum bisa dimuat</h1>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={() => window.location.reload()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Muat Ulang
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

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
      registrationTrend={stats.registrationTrend}
      recentRegistrants={stats.recentRegistrants}
      activePeriod={stats.activePeriod}
      serverHealth={health}
    />
  );
}

