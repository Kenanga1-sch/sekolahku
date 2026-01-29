
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, UserMinus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface HealthStats {
  totalStudents: number;
  missingNik: number;
  missingMother: number;
  missingDocs: number;
  completeness: number;
}

export function DataHealthWidget() {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/master/students/health"); // We need to create this endpoint
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full rounded-xl" />;
  }

  if (!stats) return null;

  return (
    <Card className="border-l-4 border-l-blue-500 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
           <CheckCircle2 className="h-4 w-4 text-blue-500" />
           Kesehatan Data Siswa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            <div>
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Kelengkapan Profil</span>
                    <span className="font-bold">{stats.completeness}%</span>
                </div>
                <Progress value={stats.completeness} className="h-2" />
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900/30 text-center">
                    <div className="text-red-600 font-bold text-lg">{stats.missingNik}</div>
                    <div className="text-red-500">Tanpa NIK</div>
                </div>
                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-100 dark:border-yellow-900/30 text-center">
                    <div className="text-yellow-600 font-bold text-lg">{stats.missingMother}</div>
                    <div className="text-yellow-500">Tanpa Ibu</div>
                </div>
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-100 dark:border-orange-900/30 text-center">
                    <div className="text-orange-600 font-bold text-lg">{stats.missingDocs}</div>
                    <div className="text-orange-500">Tanpa Dokumen</div>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
