"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { AlumniStats } from "../alumni-types";

export interface StatusDistributionBarProps {
  stats: AlumniStats | null;
  totalStudents: number;
  activePct: number;
  graduatedPct: number;
  transferredPct: number;
  droppedPct: number;
}

export function StatusDistributionBar({
  stats,
  totalStudents,
  activePct,
  graduatedPct,
  transferredPct,
  droppedPct,
}: StatusDistributionBarProps) {
  return (
        <Card className="overflow-hidden border border-slate-100 dark:border-zinc-800 shadow-sm">
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground font-medium">Distribusi Status Siswa</span>
              <span className="text-muted-foreground font-mono font-semibold">{totalStudents} Total Siswa</span>
            </div>
            <div className="h-3.5 w-full rounded-full flex overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              {stats?.activeCount ? (
                <div style={{ width: `${activePct}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Aktif: ${stats.activeCount}`} />
              ) : null}
              {stats?.graduatedCount ? (
                <div style={{ width: `${graduatedPct}%` }} className="h-full bg-blue-500 transition-all duration-300" title={`Alumni/Lulus: ${stats.graduatedCount}`} />
              ) : null}
              {stats?.transferredCount ? (
                <div style={{ width: `${transferredPct}%` }} className="h-full bg-amber-500 transition-all duration-300" title={`Pindahan: ${stats.transferredCount}`} />
              ) : null}
              {stats?.droppedCount ? (
                <div style={{ width: `${droppedPct}%` }} className="h-full bg-rose-500 transition-all duration-300" title={`Keluar: ${stats.droppedCount}`} />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span>Aktif: <strong className="text-foreground">{stats?.activeCount || 0}</strong> ({activePct.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span>Alumni: <strong className="text-foreground">{stats?.graduatedCount || 0}</strong> ({graduatedPct.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span>Pindahan: <strong className="text-foreground">{stats?.transferredCount || 0}</strong> ({transferredPct.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span>Keluar: <strong className="text-foreground">{stats?.droppedCount || 0}</strong> ({droppedPct.toFixed(0)}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
  );
}
