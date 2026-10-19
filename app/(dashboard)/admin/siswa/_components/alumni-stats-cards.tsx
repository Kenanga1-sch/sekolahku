"use client";

import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock } from "lucide-react";
import type { AlumniStats } from "../alumni-types";

export interface AlumniStatsCardsProps {
  stats: AlumniStats | null;
}

export function AlumniStatsCards({ stats }: AlumniStatsCardsProps) {
  return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-colors duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
                Total Buku Induk
              </CardTitle>
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
                {stats?.totalAlumni || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Siswa terdaftar di Buku Induk
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-emerald-500/30 dark:hover:border-emerald-400/30 transition-colors duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
                Siswa Aktif
              </CardTitle>
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
                {stats?.activeCount || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sedang aktif bersekolah
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-amber-500/30 dark:hover:border-amber-400/30 transition-colors duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
                Menunggu Verifikasi Dokumen
              </CardTitle>
              <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
                {stats?.pendingVerification || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Berkas siswa perlu diverifikasi
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
  );
}
