"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Image, FolderOpen, Trophy, HardDrive } from "lucide-react";
import CountUp from "react-countup";
import { cn } from "@/lib/utils";

interface GalleryStats {
  total: number;
  categories: Record<string, number>;
  storage: {
    used: number;
    unit: string;
  };
}

interface StatsCardsProps {
  stats: GalleryStats | null;
  isLoading: boolean;
}

const statConfig = [
  {
    key: "total",
    label: "Total Foto",
    icon: Image,
    color: "from-blue-500 to-indigo-600",
    bgColor: "bg-blue-500/10",
    iconColor: "text-blue-600",
  },
  {
    key: "kegiatan",
    label: "Kegiatan",
    icon: FolderOpen,
    color: "from-emerald-500 to-teal-600",
    bgColor: "bg-emerald-500/10",
    iconColor: "text-emerald-600",
  },
  {
    key: "prestasi",
    label: "Prestasi",
    icon: Trophy,
    color: "from-amber-500 to-orange-600",
    bgColor: "bg-amber-500/10",
    iconColor: "text-amber-600",
  },
  {
    key: "storage",
    label: "Storage",
    icon: HardDrive,
    color: "from-purple-500 to-pink-600",
    bgColor: "bg-purple-500/10",
    iconColor: "text-purple-600",
    isStorage: true,
  },
];

export function GalleryStatsCards({ stats, isLoading }: StatsCardsProps) {
  const getValue = (key: string) => {
    if (!stats) return 0;
    if (key === "total") return stats.total || 0;
    if (key === "storage") return stats.storage?.used || 0;
    if (!stats.categories) return 0;
    return stats.categories[key] || 0;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {statConfig.map((stat) => (
        <Card
          key={stat.key}
          className={cn(
            "relative overflow-hidden border border-white/20 shadow-lg group",
            "bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl",
            "hover:shadow-xl hover:scale-[1.02] transition-all duration-300",
            "dark:border-white/10"
          )}
        >
          {/* Background Gradient Blob */}
          <div
            className={cn(
              "absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition-all group-hover:opacity-40",
              `bg-gradient-to-br ${stat.color}`
            )}
          />
          
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div
                className={cn(
                  "p-3 rounded-2xl shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10",
                  "bg-gradient-to-br from-white to-white/50 dark:from-zinc-800 dark:to-zinc-800/50"
                )}
              >
                <stat.icon className={cn("h-6 w-6", stat.iconColor)} />
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-3xl md:text-4xl font-bold tracking-tight text-foreground/90">
                {isLoading ? (
                  <span className="animate-pulse bg-muted/50 rounded-md h-9 w-24 inline-block" />
                ) : (
                  <div className="flex items-baseline gap-1">
                    <CountUp 
                      end={getValue(stat.key)} 
                      duration={2.5} 
                      separator="."
                      className="tabular-nums"
                    />
                    {stat.isStorage && (
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        {stats?.storage?.unit || 'MB'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-muted-foreground/80">
                {stat.label}
              </p>
            </div>
          </CardContent>
          
          {/* Bottom highlight line */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-1 opacity-0 transition-opacity group-hover:opacity-100",
            `bg-gradient-to-r ${stat.color}`
          )} />
        </Card>
      ))}
    </div>
  );
}
